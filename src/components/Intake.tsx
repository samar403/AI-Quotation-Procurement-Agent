"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { AgentEvent } from "@/lib/types";
import { SAMPLES } from "@/lib/samples";
import { Icon } from "./icons";
import { LoomGraphic, PunchLog } from "./Loom";
import { useApp, useToast } from "./ui";

const ACCEPT = ".txt,.eml,.pdf,.png,.jpg,.jpeg,.webp,.gif,text/plain,application/pdf,message/rfc822,image/*";

export function Intake() {
  const router = useRouter();
  const params = useSearchParams();
  const toast = useToast();
  const { ai, bump } = useApp();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [drag, setDrag] = useState(false);
  const [events, setEvents] = useState<AgentEvent[]>([]);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ orderId: string; quoteId: string | null; ref: string; summary: string } | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  const run = useCallback(
    async (opts: { sample?: string } = {}) => {
      if (running) return;
      if (!opts.sample && !text.trim() && !file) {
        toast("Paste a message or drop a file first", true);
        return;
      }
      setEvents([]);
      setResult(null);
      setRunning(true);
      const form = new FormData();
      if (opts.sample) form.set("sample", opts.sample);
      else {
        if (text.trim()) form.set("text", text);
        if (file) form.set("file", file);
      }
      try {
        const res = await fetch("/api/ingest", { method: "POST", body: form });
        if (!res.ok || !res.body) {
          const err = await res.json().catch(() => ({ error: "Upload failed" }));
          throw new Error(err.error);
        }
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const l of lines) {
            if (!l.trim()) continue;
            const e = JSON.parse(l) as AgentEvent;
            if (e.stage === "done") {
              const d = e.data as { orderId: string; quoteId: string | null; ref: string };
              setResult({ ...d, summary: e.message });
            } else if (e.stage === "error") {
              toast(e.message, true);
              setEvents((x) => [...x, e]);
            } else {
              setEvents((x) => [...x, e]);
              const w = (e.data as { warnings?: string[] } | undefined)?.warnings;
              w?.forEach((m) => toast(m, true));
            }
          }
        }
        bump();
      } catch (err) {
        toast((err as Error).message, true);
      } finally {
        setRunning(false);
      }
    },
    [running, text, file, toast, bump],
  );

  useEffect(() => {
    const s = params.get("sample");
    if (s && !started.current) {
      started.current = true;
      run({ sample: s });
    }
  }, [params, run]);

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDrag(false);
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
    else {
      const t = e.dataTransfer.getData("text");
      if (t) setText(t);
    }
  };
  const onPaste = (e: React.ClipboardEvent) => {
    const f = [...e.clipboardData.files][0];
    if (f) {
      e.preventDefault();
      setFile(f);
    }
  };

  const showLoom = running || events.length > 0;

  return (
    <div className="stack" style={{ gap: 22 }}>
      <div
        className={`dropzone${drag ? " drag" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}
      >
        <textarea
          aria-label="Paste the buyer's message"
          placeholder={`Paste the buyer's WhatsApp message, email or requirement here…\n\ne.g. "Poplin 40x40 58" white 2000 mtr @82, rayon 30s navy 1500 mtr, 12 Nov tak Ahmedabad"\n\n— or drop a WhatsApp chat export (.txt), an email (.eml), a PDF PO, or a photo of a handwritten order.`}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onPaste={onPaste}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") run();
          }}
          disabled={running}
        />
        <div className="dz-bar">
          <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <button className="btn btn-sm" onClick={() => inputRef.current?.click()} disabled={running}>
            <Icon.Upload size={16} /> Attach file
          </button>
          {file && (
            <span className="chip-file">
              {file.type.startsWith("image/") ? <Icon.Image size={15} /> : file.type === "application/pdf" ? <Icon.Pdf size={15} /> : <Icon.Receipt size={15} />}
              {file.name}
              <button className="btn btn-ghost btn-sm" style={{ height: 22, padding: "0 4px" }} onClick={() => setFile(null)} aria-label="Remove file">
                <Icon.X size={14} />
              </button>
            </span>
          )}
          <div className="sources hide-sm">
            <span className="source-pill"><Icon.Chat size={14} /> WhatsApp export</span>
            <span className="source-pill"><Icon.Mail size={14} /> .eml</span>
            <span className="source-pill"><Icon.Pdf size={14} /> PDF</span>
            <span className="source-pill" title={ai?.ai ? "" : "Needs ANTHROPIC_API_KEY"}><Icon.Image size={14} /> Photo{ai && !ai.ai ? " (AI)" : ""}</span>
          </div>
          <div style={{ flex: 1 }} />
          <span className="faint hide-sm" style={{ fontSize: 12 }}><span className="kbd">⌘</span> + <span className="kbd">↵</span></span>
          <button className="btn btn-primary" onClick={() => run()} disabled={running}>
            {running ? <span className="bobbin" /> : <Icon.Spark size={17} />} {running ? "Weaving…" : "Read & quote"}
          </button>
        </div>
      </div>

      {showLoom && (
        <div className="card loom-wrap">
          <div className="loom-stage">
            <div className="spread" style={{ marginBottom: 10 }}>
              <div>
                <div className="eyebrow">Agent run</div>
                <h3 style={{ fontSize: 20, marginTop: 2 }}>{result ? "Woven. Your quotation is ready." : running ? "Weaving your quotation…" : "Run stopped"}</h3>
              </div>
              {result && (
                <span className="badge b-mehendi">{result.ref}</span>
              )}
            </div>
            <LoomGraphic events={events} running={running} />
            {result && (
              <div className="stack" style={{ gap: 12, marginTop: 14 }}>
                <p style={{ margin: 0 }} className="muted">{result.summary}</p>
                <div className="row wrap">
                  <button className="btn btn-primary" onClick={() => router.push(`/desk/orders/${result.orderId}`)}>
                    Open order workspace <Icon.Arrow size={16} />
                  </button>
                  {result.quoteId && (
                    <Link className="btn" href={`/desk/quotes/${result.quoteId}`}>
                      <Icon.Receipt size={16} /> View quotation
                    </Link>
                  )}
                  <button
                    className="btn btn-ghost"
                    onClick={() => {
                      setEvents([]);
                      setResult(null);
                      setText("");
                      setFile(null);
                    }}
                  >
                    Read another
                  </button>
                </div>
              </div>
            )}
          </div>
          <PunchLog events={events} />
        </div>
      )}

      {!showLoom && (
        <div>
          <div className="spread" style={{ marginBottom: 12 }}>
            <div>
              <div className="eyebrow">No order handy?</div>
              <h3 style={{ fontSize: 20, marginTop: 2 }}>Try a real-world sample</h3>
            </div>
          </div>
          <div className="grid g4">
            {SAMPLES.map((s) => (
              <div key={s.id} className="sample" role="button" tabIndex={0} onClick={() => run({ sample: s.id })} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && run({ sample: s.id })}>
                <span className="row" style={{ gap: 6, color: "var(--ink-3)" }}>
                  {s.kind === "whatsapp" ? <Icon.Chat size={15} /> : s.kind === "email" ? <Icon.Mail size={15} /> : s.kind === "pdf" ? <Icon.Pdf size={15} /> : <Icon.Receipt size={15} />}
                  <span className="eyebrow">{s.kind}</span>
                </span>
                <strong>{s.title}</strong>
                <span>{s.from}</span>
                <span style={{ marginTop: 4 }}>{s.blurb}</span>
                <a className="faint" style={{ fontSize: 12, marginTop: 6, textDecoration: "underline" }} href={`/api/samples/${s.id}`} onClick={(e) => e.stopPropagation()}>
                  Download file
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
