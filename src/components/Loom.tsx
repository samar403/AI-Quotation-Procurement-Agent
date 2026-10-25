"use client";

import type { AgentEvent, AgentStage } from "@/lib/types";

export const STAGES: Array<{ id: AgentStage; label: string; dye: string; verb: string }> = [
  { id: "receive", label: "Receive", dye: "var(--ink-3)", verb: "Taking the document" },
  { id: "read", label: "Read", dye: "var(--kasturi)", verb: "Detecting format" },
  { id: "extract", label: "Extract", dye: "var(--indigo)", verb: "Reading requirements" },
  { id: "match", label: "Match", dye: "var(--rani)", verb: "Matching mill catalogs" },
  { id: "compare", label: "Compare", dye: "var(--turmeric)", verb: "Costing every offer" },
  { id: "quote", label: "Quote", dye: "var(--madder)", verb: "Pricing the quotation" },
  { id: "approve", label: "Approve", dye: "var(--mehendi)", verb: "Checking guardrails" },
];

const WARPS = 26;
const X0 = 112;
const X1 = 548;
const ROW = 36;
const Y0 = 20;

// A live loom: each finished agent stage weaves one dyed weft band, bottom to top.
export function LoomGraphic({ events, running }: { events: AgentEvent[]; running: boolean }) {
  const done = new Set(events.filter((e) => e.status === "done").map((e) => e.stage));
  const errored = new Set(events.filter((e) => e.status === "error").map((e) => e.stage));
  const activeIdx = running ? STAGES.findIndex((s) => !done.has(s.id) && !errored.has(s.id)) : -1;
  const gap = (X1 - X0) / WARPS;
  const height = Y0 * 2 + STAGES.length * ROW;
  return (
    <svg className="loom-svg" viewBox={`0 0 560 ${height}`} role="img" aria-label="Agent progress loom">
      <defs>
        <linearGradient id="beam" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--rule-2)" />
          <stop offset="1" stopColor="var(--rule)" />
        </linearGradient>
      </defs>
      {/* breast beam + cloth beam */}
      <rect x={X0 - 10} y={4} width={X1 - X0 + 20} height={8} rx={4} fill="url(#beam)" />
      <rect x={X0 - 10} y={height - 12} width={X1 - X0 + 20} height={8} rx={4} fill="url(#beam)" />
      {/* warp threads */}
      {Array.from({ length: WARPS + 1 }, (_, k) => (
        <line key={k} className={`warp${done.size ? " on" : ""}`} x1={X0 + k * gap} x2={X0 + k * gap} y1={12} y2={height - 12} />
      ))}
      {STAGES.map((s, i) => {
        // weave from the bottom up, like cloth coming off a loom
        const y = height - Y0 - (i + 1) * ROW + 6;
        const isDone = done.has(s.id);
        const isErr = errored.has(s.id);
        const isActive = i === activeIdx;
        return (
          <g key={s.id}>
            <circle className={`heddle${isDone ? " on" : ""}${isActive ? " active" : ""}`} cx={14} cy={y + ROW / 2 - 3} r={5} />
            <text x={28} y={y + ROW / 2} className={isDone || isActive ? "on" : ""}>
              {s.label}
            </text>
            {(isDone || isErr) && (
              <g className="weft" style={{ animationDelay: "0ms" }}>
                <rect x={X0} y={y} width={X1 - X0} height={ROW - 12} rx={3} fill={isErr ? "var(--madder)" : s.dye} opacity={isErr ? 0.35 : 0.92} />
                {Array.from({ length: WARPS }, (_, k) =>
                  (k + i) % 2 === 0 ? <rect key={k} x={X0 + k * gap + gap * 0.38} y={y - 1} width={gap * 0.24} height={ROW - 10} rx={1.5} fill="var(--card)" opacity={0.5} /> : null,
                )}
              </g>
            )}
            {isActive && (
              <g>
                <rect x={X0} y={y} width={X1 - X0} height={ROW - 12} rx={3} fill={s.dye} opacity={0.08} />
                <g style={{ animation: "shuttle 1.4s ease-in-out infinite alternate" }}>
                  <rect x={X0} y={y + 3} width={64} height={ROW - 18} rx={(ROW - 18) / 2} fill="var(--ink)" />
                  <rect x={X0 + 22} y={y + 7} width={20} height={ROW - 26} rx={2} fill={s.dye} />
                </g>
              </g>
            )}
          </g>
        );
      })}
      <style>{`@keyframes shuttle{from{transform:translateX(0)}to{transform:translateX(${X1 - X0 - 64}px)}}`}</style>
    </svg>
  );
}

function holes(seed: string) {
  let h = 0;
  for (const c of seed) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return Array.from({ length: 9 }, (_, i) => (h >> i) & 1);
}

export function PunchLog({ events }: { events: AgentEvent[] }) {
  return (
    <div className="punchcards" aria-live="polite">
      {events.length === 0 && <div className="faint" style={{ fontSize: 13 }}>Each step the agent takes is punched onto a card here — like a Jacquard loom reading its pattern.</div>}
      {events
        .filter((e) => e.status !== "start" || !events.some((x) => x.stage === e.stage && x.status !== "start"))
        .map((e, i) => (
          <div key={i} className={`punch${e.status === "error" ? " error" : ""}`}>
            <div className="holes">
              {holes(e.stage + e.message).map((p, j) => (
                <i key={j} className={p ? "p" : ""} />
              ))}
            </div>
            <div>
              <div className="stage-name">
                {e.stage} {e.status === "start" ? "· working" : ""}
              </div>
              <div>{e.message}</div>
            </div>
          </div>
        ))}
    </div>
  );
}
