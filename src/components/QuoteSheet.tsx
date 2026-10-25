"use client";

import { useState } from "react";
import type { Quote, Settings } from "@/lib/types";
import { fmtDate, inr, qty, timeAgo, UNIT_LABEL } from "@/lib/format";
import { Icon } from "./icons";
import { api, copy, Modal, StatusBadge, useApp, useToast } from "./ui";

const STAMP: Partial<Record<Quote["status"], [string, string]>> = {
  approved: ["APPROVED", "var(--mehendi)"],
  sent: ["SENT", "var(--indigo)"],
  won: ["ORDER WON", "var(--mehendi)"],
  rejected: ["REJECTED", "var(--madder)"],
  lost: ["LOST", "var(--madder)"],
};

export function QuoteSheet({ quote, settings, onChange }: { quote: Quote; settings: Settings | null; onChange?: (q: Quote) => void }) {
  const toast = useToast();
  const { actor } = useApp();
  const [busy, setBusy] = useState<string | null>(null);
  const editable = !!onChange && ["pending_approval", "approved", "draft", "rejected"].includes(quote.status);
  const stamp = STAMP[quote.status];
  const lastApproval = [...quote.approvals].reverse().find((a) => a.action === "approved" || a.action === "auto_approved");

  const setMargin = async (itemId: string, value: string, kind: "marginPct" | "unitPrice") => {
    const n = Number(value);
    if (!Number.isFinite(n)) return;
    setBusy(itemId);
    try {
      const r = await api<{ quote: Quote }>(`/api/quotes/${quote.id}`, { method: "PATCH", json: { itemId, [kind]: n, by: actor } });
      onChange?.(r.quote);
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="billbook carbon">
      {stamp && (
        <div className="stamp" key={quote.status} style={{ ["--sc" as string]: stamp[1] }}>
          {stamp[0]}
          <small>
            {quote.status === "approved" && lastApproval ? `${lastApproval.by} · ${fmtDate(lastApproval.at, { day: "numeric", month: "short" })}` : fmtDate(quote.updatedAt, { day: "numeric", month: "short" })}
          </small>
        </div>
      )}
      <div className="spread" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "var(--font-display)", fontSize: 22, fontWeight: 620, color: "var(--ink)" }}>{settings?.business.name ?? "—"}</div>
          <div className="faint" style={{ fontSize: 12.5, maxWidth: 360 }}>{settings?.business.address}</div>
          <div className="faint num" style={{ fontSize: 11.5 }}>GSTIN {settings?.business.gstin}</div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div className="bill-title">Quotation</div>
          <div className="num" style={{ fontWeight: 600 }}>
            {quote.number}
            {quote.revision > 1 && <span className="faint"> · rev {quote.revision}</span>}
          </div>
          <div className="faint" style={{ fontSize: 12.5 }}>Valid until {fmtDate(quote.validUntil)}</div>
        </div>
      </div>

      <div className="grid g2" style={{ marginTop: 18, gap: 12 }}>
        <div>
          <div className="eyebrow">Quoted to</div>
          <div style={{ fontWeight: 650, color: "var(--ink)" }}>{quote.customer.company ?? quote.customer.name}</div>
          <div className="faint" style={{ fontSize: 12.5 }}>
            {[quote.customer.company ? quote.customer.name : "", quote.customer.city, quote.customer.phone, quote.customer.gstin && `GSTIN ${quote.customer.gstin}`].filter(Boolean).join(" · ")}
          </div>
        </div>
        <div>
          <div className="eyebrow">Delivery</div>
          <div style={{ fontWeight: 650, color: "var(--ink)" }}>{quote.deliveryBy ? `By ${fmtDate(quote.deliveryBy)}` : "7–10 days from confirmation"}</div>
          <div className="faint" style={{ fontSize: 12.5 }}>Ref {quote.orderRef}</div>
        </div>
      </div>

      <div className="table-scroll">
        <table className="bill-lines">
          <thead>
            <tr>
              <th>#</th>
              <th>Description</th>
              <th className="right">Qty</th>
              <th className="right no-print">Cost</th>
              <th className="right no-print">Margin</th>
              <th className="right">Rate</th>
              <th className="right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {quote.lines.map((l, i) => (
              <tr key={l.itemId}>
                <td className="faint num">{i + 1}</td>
                <td style={{ color: "var(--ink)" }}>
                  <div style={{ fontWeight: 600 }}>{l.description.split(" — ")[0]}</div>
                  <div className="faint" style={{ fontSize: 12 }}>{l.description.split(" — ")[1]}</div>
                  <div className="faint" style={{ fontSize: 11.5 }}>
                    HSN {l.hsn}
                    <span className="no-print">{l.supplierName ? ` · from ${l.supplierName}` : " · no supplier price"}</span>
                  </div>
                  {l.note && <div className="no-print" style={{ fontSize: 12, color: "var(--madder)", marginTop: 2 }}>{l.note}</div>}
                </td>
                <td className="right num" style={{ whiteSpace: "nowrap" }}>
                  {qty(l.quantity)} {UNIT_LABEL[l.unit]}
                </td>
                <td className="right num faint no-print">{l.costPrice ? inr(l.costPrice) : "—"}</td>
                <td className="right no-print">
                  {editable && l.costPrice ? (
                    <input
                      key={`${quote.updatedAt}-${l.itemId}`}
                      className="margin-input"
                      defaultValue={l.marginPct.toFixed(1)}
                      aria-label={`Margin % for ${l.description}`}
                      disabled={busy === l.itemId}
                      onBlur={(e) => Number(e.target.value) !== Number(l.marginPct.toFixed(1)) && setMargin(l.itemId, e.target.value, "marginPct")}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    />
                  ) : (
                    <span className="num" style={{ color: l.marginPct < (settings?.approval.requireApprovalIfMarginBelow ?? 0) ? "var(--madder)" : undefined }}>{l.marginPct.toFixed(1)}%</span>
                  )}
                </td>
                <td className="right num" style={{ color: "var(--ink)" }}>
                  {editable && l.costPrice ? (
                    <input
                      key={`p-${quote.updatedAt}-${l.itemId}`}
                      className="margin-input"
                      style={{ width: 76 }}
                      defaultValue={l.unitPrice}
                      aria-label={`Rate for ${l.description}`}
                      disabled={busy === l.itemId}
                      onBlur={(e) => Number(e.target.value) !== l.unitPrice && setMargin(l.itemId, e.target.value, "unitPrice")}
                      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
                    />
                  ) : (
                    inr(l.unitPrice)
                  )}
                </td>
                <td className="right num" style={{ fontWeight: 600, color: "var(--ink)" }}>{inr(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="spread" style={{ marginTop: 16, alignItems: "flex-end", flexWrap: "wrap" }}>
        <div className="no-print" style={{ fontSize: 12.5 }}>
          <div className="faint">
            Cost {inr(Math.round(quote.cost))} · Gross profit <b style={{ color: "var(--mehendi)" }}>{inr(Math.round(quote.grossProfit))}</b> · {quote.marginPct.toFixed(1)}% blended
          </div>
        </div>
        <div style={{ minWidth: 240 }}>
          <div className="spread" style={{ fontSize: 13.5 }}>
            <span className="faint">Subtotal</span>
            <span className="num">{inr(quote.subtotal)}</span>
          </div>
          <div className="spread" style={{ fontSize: 13.5 }}>
            <span className="faint">GST @ {quote.taxRate}%</span>
            <span className="num">{inr(quote.tax)}</span>
          </div>
          <div className="spread" style={{ borderTop: "1.5px solid var(--ink)", marginTop: 6, paddingTop: 6 }}>
            <span style={{ fontWeight: 600, color: "var(--ink)" }}>Total</span>
            <span className="bill-total num" style={{ color: "var(--ink)" }}>{inr(quote.total)}</span>
          </div>
        </div>
      </div>

      <ol style={{ fontSize: 12, margin: "18px 0 0", paddingLeft: 18 }} className="faint">
        {quote.terms.map((t) => (
          <li key={t}>{t}</li>
        ))}
      </ol>
    </div>
  );
}

export function ApprovalPanel({ quote, onChange }: { quote: Quote; onChange: (q: Quote) => void }) {
  const toast = useToast();
  const { actor } = useApp();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState<"whatsapp" | "email" | null>(null);

  const act = async (action: string, extra: Record<string, string> = {}) => {
    setBusy(true);
    try {
      const r = await api<{ quote: Quote }>(`/api/quotes/${quote.id}/action`, { method: "POST", json: { action, by: actor, note: note || undefined, ...extra } });
      onChange(r.quote);
      setNote("");
      toast(
        { approve: "Approved — stamped and ready to send", reject: "Quote rejected", send: "Marked as sent to the buyer", won: "Order won! 🎉", lost: "Marked as lost", reopen: "Reopened for revision" }[action] ?? "Updated",
      );
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setBusy(false);
    }
  };

  const phone = (quote.customer.phone ?? "").replace(/[^\d]/g, "");
  const waLink = `https://wa.me/${phone.length === 10 ? `91${phone}` : phone}?text=${encodeURIComponent(quote.drafts.whatsapp)}`;
  const mailLink = `mailto:${quote.customer.email ?? ""}?subject=${encodeURIComponent(quote.drafts.email.subject)}&body=${encodeURIComponent(quote.drafts.email.body)}`;

  return (
    <div className="card">
      <div className="card-head">
        <h3>Approval</h3>
        <StatusBadge status={quote.status} />
      </div>
      <div className="card-pad stack" style={{ gap: 14 }}>
        {quote.approvalReasons.length > 0 && quote.status === "pending_approval" && (
          <div>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Guardrails tripped</div>
            {quote.approvalReasons.map((r) => (
              <div className="guard" key={r}>
                <Icon.Alert size={16} />
                <span>{r}</span>
              </div>
            ))}
          </div>
        )}
        {quote.status === "approved" && !quote.requiresApproval && quote.approvals.some((a) => a.action === "auto_approved") && (
          <div className="guard" style={{ background: "var(--mehendi-soft)" }}>
            <Icon.Check size={16} /> Auto-approved: within margin, value and confidence guardrails.
          </div>
        )}

        {(quote.status === "pending_approval" || quote.status === "rejected") && (
          <>
            <textarea className="textarea" rows={2} placeholder="Note for the team (optional) — e.g. “Checked rate with Hitesh”" value={note} onChange={(e) => setNote(e.target.value)} />
            <div className="row wrap">
              <button className="btn btn-mehendi" disabled={busy} onClick={() => act("approve")}>
                <Icon.Check size={16} /> Approve as {actor.split(" ")[0]}
              </button>
              {quote.status === "pending_approval" && (
                <button className="btn" disabled={busy} onClick={() => act("reject")}>
                  <Icon.X size={16} /> Reject
                </button>
              )}
            </div>
          </>
        )}

        {quote.status === "approved" && (
          <div className="stack" style={{ gap: 10 }}>
            <div className="row wrap">
              <button className="btn btn-primary" onClick={() => setDraft("whatsapp")}>
                <Icon.Chat size={16} /> Send on WhatsApp
              </button>
              <button className="btn" onClick={() => setDraft("email")}>
                <Icon.Mail size={16} /> Email
              </button>
              <a className="btn" href={`/api/quotes/${quote.id}/pdf`}>
                <Icon.Download size={16} /> PDF
              </a>
            </div>
          </div>
        )}

        {quote.status === "sent" && (
          <div className="row wrap">
            <button className="btn btn-mehendi" disabled={busy} onClick={() => act("won")}>
              <Icon.Trophy size={16} /> Buyer confirmed — won
            </button>
            <button className="btn" disabled={busy} onClick={() => act("lost", { note: note || "Price not accepted" })}>
              Lost
            </button>
            <button className="btn btn-ghost" onClick={() => setDraft("whatsapp")}>
              Resend
            </button>
          </div>
        )}

        {["won", "lost", "sent"].includes(quote.status) && (
          <button className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start" }} disabled={busy} onClick={() => act("reopen")}>
            <Icon.Edit size={14} /> Reopen & revise
          </button>
        )}

        <div>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Trail</div>
          <div className="timeline">
            {[...quote.approvals].reverse().map((a, i) => (
              <div className="tl" key={i} style={{ ["--dc" as string]: a.action === "rejected" || a.action === "lost" ? "var(--madder)" : a.action === "approved" || a.action === "auto_approved" || a.action === "won" ? "var(--mehendi)" : "var(--indigo)" }}>
                <time>{timeAgo(a.at)}</time>
                <b>{a.by}</b> {a.action.replace("_", "-")}
                {a.note ? <span className="faint"> — {a.note}</span> : null}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Modal open={draft !== null} onClose={() => setDraft(null)}>
        <div className="spread" style={{ marginBottom: 12 }}>
          <h3 style={{ fontSize: 20 }}>{draft === "whatsapp" ? "WhatsApp message" : "Email"}</h3>
          <button className="btn btn-ghost btn-sm" onClick={() => setDraft(null)} aria-label="Close">
            <Icon.X />
          </button>
        </div>
        {draft === "whatsapp" ? (
          <div className="wa-wall">
            <div className="wa">{quote.drafts.whatsapp}</div>
          </div>
        ) : (
          <div className="card card-pad" style={{ whiteSpace: "pre-wrap", fontSize: 13.5, maxHeight: 360, overflow: "auto" }}>
            <b>{quote.drafts.email.subject}</b>
            {"\n\n"}
            {quote.drafts.email.body}
          </div>
        )}
        <div className="row wrap" style={{ marginTop: 14 }}>
          <a
            className="btn btn-primary"
            href={draft === "whatsapp" ? waLink : mailLink}
            target="_blank"
            rel="noreferrer"
            onClick={() => {
              if (quote.status === "approved") act("send", { channel: draft === "whatsapp" ? "WhatsApp" : "email" });
              setDraft(null);
            }}
          >
            <Icon.Send size={16} /> Open {draft === "whatsapp" ? "WhatsApp" : "mail app"} & mark sent
          </a>
          <button
            className="btn"
            onClick={async () => {
              const ok = await copy(draft === "whatsapp" ? quote.drafts.whatsapp : `${quote.drafts.email.subject}\n\n${quote.drafts.email.body}`);
              toast(ok ? "Copied to clipboard" : "Couldn't copy — select the text instead", !ok);
            }}
          >
            <Icon.Copy size={16} /> Copy
          </button>
        </div>
      </Modal>
    </div>
  );
}
