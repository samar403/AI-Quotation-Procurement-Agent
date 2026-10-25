"use client";

import Link from "next/link";
import { use, useState } from "react";
import { useRouter } from "next/navigation";
import type { Order, Quote, RequirementItem, Settings } from "@/lib/types";
import { fmtDate, timeAgo } from "@/lib/format";
import { Icon } from "@/components/icons";
import { api, Confidence, copy, Modal, SourceTag, Spinner, StatusBadge, useApi, useApp, useToast } from "@/components/ui";
import { RequirementSheet } from "@/components/RequirementSheet";
import { ComparisonPanel } from "@/components/Comparison";
import { ApprovalPanel, QuoteSheet } from "@/components/QuoteSheet";

type Data = { order: Order; quote: Quote | null };
type Rfq = Array<{ itemId: string; product: string; suppliers: Array<{ supplierId: string; name: string; phone: string; message: string }> }>;

const DOT: Record<string, string> = { ingest: "var(--ink-3)", extract: "var(--indigo)", compare: "var(--turmeric)", quote: "var(--madder)", approval: "var(--mehendi)", send: "var(--indigo)", outcome: "var(--mehendi)", edit: "var(--kasturi)", rfq: "var(--rani)" };

export default function OrderWorkspace({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const toast = useToast();
  const { actor, bump } = useApp();
  const { data, error, setData } = useApi<Data>(`/api/orders/${id}`);
  const { data: settings } = useApi<Settings>("/api/settings");
  const [busy, setBusy] = useState(false);
  const [rfq, setRfq] = useState<Rfq | null>(null);
  const [showSource, setShowSource] = useState(false);

  if (error) return <div className="empty">{error} · <Link href="/desk/orders" style={{ textDecoration: "underline" }}>Back to orders</Link></div>;
  if (!data) return <div className="empty"><Spinner /></div>;
  const { order, quote } = data;

  const mutateOrder = async (fn: () => Promise<Data>, ok: string) => {
    setBusy(true);
    try {
      const r = await fn();
      setData((d) => (d ? { ...d, ...r } : r));
      bump();
      toast(ok);
      return true;
    } catch (e) {
      toast((e as Error).message, true);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const saveItems = (items: RequirementItem[]) =>
    mutateOrder(() => api<Data>(`/api/orders/${order.id}`, { method: "PATCH", json: { items, by: actor } }), "Saved. Suppliers re-compared and quote revised.");
  const select = (itemId: string, supplierId: string) =>
    mutateOrder(() => api<Data>(`/api/orders/${order.id}/select`, { method: "POST", json: { itemId, supplierId, by: actor } }), "Supplier switched — quote re-priced");
  const onQuote = (q: Quote) => {
    setData((d) => (d ? { ...d, quote: q, order: { ...d.order, status: q.status === "pending_approval" ? "pending_approval" : (q.status as Order["status"]) } } : d));
    bump();
  };

  const clarText = `Namaste ${order.customer.name.split(" ")[0]} ji, quick check before we share rates:\n${order.clarifications.map((c, i) => `${i + 1}. ${c}`).join("\n")}`;

  return (
    <>
      <div className="page-head">
        <div style={{ minWidth: 0 }}>
          <div className="row wrap" style={{ gap: 8 }}>
            <Link href="/desk/orders" className="eyebrow">← Orders</Link>
            <span className="eyebrow">/ {order.ref}</span>
          </div>
          <h1 style={{ marginTop: 4 }}>{order.customer.company ?? order.customer.name}</h1>
          <p>{order.extraction.summary}</p>
          <div className="row wrap" style={{ marginTop: 10 }}>
            <StatusBadge status={order.status} />
            <SourceTag type={order.source.type} />
            <span className="source-pill">
              <Icon.Spark size={14} /> {order.extraction.engine === "claude" ? `Claude · ${order.extraction.language ?? ""}` : "Built-in parser"} · <Confidence value={order.extraction.confidence} />
            </span>
            {order.deliveryBy && (
              <span className="source-pill">
                <Icon.Clock size={14} /> Needed by {fmtDate(order.deliveryBy)}
                {order.deliveryLocation ? ` · ${order.deliveryLocation}` : ""}
              </span>
            )}
            {order.paymentTerms && <span className="source-pill">{order.paymentTerms}</span>}
          </div>
        </div>
        <div className="row wrap no-print">
          <button
            className="btn"
            onClick={async () => {
              try {
                setRfq(await api<Rfq>(`/api/orders/${order.id}/rfq`));
              } catch (e) {
                toast((e as Error).message, true);
              }
            }}
          >
            <Icon.Send size={16} /> Ask mills for rates
          </button>
          <button
            className="btn btn-ghost"
            aria-label="Delete order"
            onClick={async () => {
              if (!confirm(`Delete ${order.ref} and its quotation?`)) return;
              await api(`/api/orders/${order.id}`, { method: "DELETE" });
              bump();
              router.push("/desk/orders");
            }}
          >
            <Icon.Trash size={16} />
          </button>
        </div>
      </div>

      {order.extraction.warnings.length > 0 && (
        <div className="stack" style={{ gap: 6, marginBottom: 16 }}>
          {order.extraction.warnings.map((w) => (
            <div className="guard" key={w}>
              <Icon.Alert size={16} /> {w}
            </div>
          ))}
        </div>
      )}

      <div className="ws-grid">
        <div className="stack" style={{ gap: 20, minWidth: 0 }}>
          <RequirementSheet key={order.updatedAt} items={order.items} onSave={saveItems} busy={busy} />

          {order.clarifications.length > 0 && (
            <div className="card card-pad">
              <div className="spread" style={{ alignItems: "flex-start" }}>
                <div>
                  <div className="eyebrow">Open questions for the buyer</div>
                  <ol style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 14 }}>
                    {order.clarifications.map((c) => (
                      <li key={c}>{c}</li>
                    ))}
                  </ol>
                </div>
                <button
                  className="btn btn-sm"
                  onClick={async () => {
                    const ok = await copy(clarText);
                    toast(ok ? "Questions copied — paste them into WhatsApp" : "Couldn't copy", !ok);
                  }}
                >
                  <Icon.Copy size={15} /> Copy for WhatsApp
                </button>
              </div>
            </div>
          )}

          <ComparisonPanel items={order.items} comparisons={order.comparisons} onSelect={select} busy={busy} />

          {quote ? (
            <div>
              <div className="spread" style={{ marginBottom: 10 }}>
                <h3 style={{ fontSize: 20 }}>Quotation</h3>
                <div className="row">
                  <Link href={`/desk/quotes/${quote.id}`} className="btn btn-ghost btn-sm">
                    Full page <Icon.Arrow size={15} />
                  </Link>
                  <a className="btn btn-sm" href={`/api/quotes/${quote.id}/pdf`}>
                    <Icon.Download size={15} /> PDF
                  </a>
                </div>
              </div>
              <QuoteSheet quote={quote} settings={settings} onChange={onQuote} />
            </div>
          ) : (
            <div className="card empty">No quotation yet — none of your mills list these items. Use “Ask mills for rates” to send RFQs.</div>
          )}
        </div>

        <div className="stack ws-side" style={{ gap: 20 }}>
          {quote && <ApprovalPanel quote={quote} onChange={onQuote} />}

          <div className="card">
            <div className="card-head">
              <h3>Buyer</h3>
            </div>
            <div className="card-pad stack" style={{ gap: 4, fontSize: 14 }}>
              <b>{order.customer.name}</b>
              {order.customer.company && <span>{order.customer.company}</span>}
              {[order.customer.city, order.customer.phone, order.customer.email].filter(Boolean).map((x) => (
                <span key={x} className="muted">{x}</span>
              ))}
              {order.customer.gstin && <span className="faint num" style={{ fontSize: 12.5 }}>GSTIN {order.customer.gstin}</span>}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Original message</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowSource((s) => !s)}>
                {showSource ? "Hide" : "Show"}
              </button>
            </div>
            <div className="card-pad">
              <div className="faint" style={{ fontSize: 12.5 }}>
                {order.source.fileName ?? "Pasted text"} · {order.source.chars.toLocaleString("en-IN")} chars
              </div>
              {showSource && (
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "var(--font-mono)", fontSize: 12, margin: "10px 0 0", maxHeight: 340, overflow: "auto", background: "var(--card-2)", padding: 12, borderRadius: 8 }}>
                  {order.source.preview || "(binary file — read by AI vision)"}
                </pre>
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-head">
              <h3>Timeline</h3>
            </div>
            <div className="card-pad">
              <div className="timeline">
                {[...order.timeline].reverse().map((t, i) => (
                  <div className="tl" key={i} style={{ ["--dc" as string]: DOT[t.kind] }}>
                    <time>
                      {timeAgo(t.at)}
                      {t.actor ? ` · ${t.actor}` : ""}
                    </time>
                    {t.text}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal open={rfq !== null} onClose={() => setRfq(null)}>
        <div className="spread" style={{ marginBottom: 6 }}>
          <h3 style={{ fontSize: 20 }}>Request rates from your mills</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => setRfq(null)} aria-label="Close">
            <Icon.X />
          </button>
        </div>
        <p className="muted" style={{ marginTop: 0, fontSize: 13.5 }}>One tap opens WhatsApp with a ready RFQ for each supplier that deals in the category.</p>
        <div className="stack" style={{ gap: 14, maxHeight: "56vh", overflow: "auto" }}>
          {rfq?.map((r) => (
            <div key={r.itemId}>
              <b>{r.product}</b>
              {r.suppliers.length === 0 && <div className="faint" style={{ fontSize: 13 }}>No mill in your network deals in this category yet.</div>}
              {r.suppliers.map((s) => (
                <div key={s.supplierId} className="spread" style={{ padding: "6px 0", borderBottom: "1px dashed var(--rule)", fontSize: 13.5 }}>
                  <span>{s.name}</span>
                  <a className="btn btn-sm" target="_blank" rel="noreferrer" href={`https://wa.me/${s.phone.replace(/[^\d]/g, "")}?text=${encodeURIComponent(s.message)}`}>
                    <Icon.Chat size={14} /> RFQ
                  </a>
                </div>
              ))}
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
