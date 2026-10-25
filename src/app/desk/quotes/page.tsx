"use client";

import Link from "next/link";
import { Spinner, StatusBadge, useApi } from "@/components/ui";
import { Icon } from "@/components/icons";
import { fmtDate, inr } from "@/lib/format";
import type { Quote } from "@/lib/types";

export default function QuotesPage() {
  const { data, loading } = useApi<Quote[]>("/api/quotes");
  const total = (s: Quote["status"][]) => (data ?? []).filter((q) => s.includes(q.status)).reduce((a, q) => a + q.total, 0);
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Quotations</div>
          <h1>The bill book</h1>
          <p>Every quotation the agent drafted, with its margin, guardrails and approval trail.</p>
        </div>
      </div>
      <div className="grid g4" style={{ marginBottom: 18 }}>
        {(
          [
            ["Needs approval", ["pending_approval"], "var(--turmeric)"],
            ["Ready to send", ["approved"], "var(--mehendi)"],
            ["With buyers", ["sent"], "var(--indigo)"],
            ["Won", ["won"], "var(--mehendi)"],
          ] as const
        ).map(([label, s, c]) => (
          <div key={label} className="card stat" style={{ ["--accent" as string]: c }}>
            <div className="label">{label}</div>
            <div className="value" style={{ fontSize: 28 }}>{inr(Math.round(total([...s])))}</div>
            <div className="hint">{(data ?? []).filter((q) => (s as readonly string[]).includes(q.status)).length} quotations</div>
          </div>
        ))}
      </div>
      <div className="card table-scroll">
        {loading && !data ? (
          <div className="empty">
            <Spinner />
          </div>
        ) : !data?.length ? (
          <div className="empty">No quotations yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Number</th>
                <th>Buyer</th>
                <th>Lines</th>
                <th className="right">Total</th>
                <th className="right">Margin</th>
                <th>Valid until</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((q) => (
                <tr key={q.id} className="clickable" onClick={() => (location.href = `/desk/quotes/${q.id}`)}>
                  <td>
                    <Link href={`/desk/quotes/${q.id}`} className="num" style={{ fontWeight: 600 }}>
                      {q.number}
                    </Link>
                    {q.revision > 1 && <div className="faint" style={{ fontSize: 12 }}>rev {q.revision}</div>}
                  </td>
                  <td>
                    <b>{q.customer.company ?? q.customer.name}</b>
                    <div className="faint" style={{ fontSize: 12.5 }}>{q.orderRef}</div>
                  </td>
                  <td className="num">{q.lines.length}</td>
                  <td className="right num" style={{ fontWeight: 600 }}>{inr(Math.round(q.total))}</td>
                  <td className="right num" style={{ color: q.marginPct < 6 ? "var(--madder)" : undefined }}>{q.marginPct.toFixed(1)}%</td>
                  <td className="num" style={{ fontSize: 13 }}>{fmtDate(q.validUntil, { day: "numeric", month: "short" })}</td>
                  <td>
                    <StatusBadge status={q.status} />
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <a className="btn btn-ghost btn-sm" href={`/api/quotes/${q.id}/pdf`} aria-label="Download PDF">
                      <Icon.Download size={16} />
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
