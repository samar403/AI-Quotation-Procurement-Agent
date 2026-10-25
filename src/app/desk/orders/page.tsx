"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Confidence, SourceTag, Spinner, StatusBadge, useApi } from "@/components/ui";
import { Icon } from "@/components/icons";
import { fmtDate, inr, timeAgo } from "@/lib/format";
import type { OrderStatus, SourceType } from "@/lib/types";

interface OrderRow {
  id: string;
  ref: string;
  createdAt: string;
  status: OrderStatus;
  source: SourceType;
  customer: { name: string; company?: string; city?: string };
  summary: string;
  items: number;
  engine: "claude" | "heuristic";
  confidence: number;
  deliveryBy?: string | null;
  quote: { id: string; number: string; total: number; marginPct: number; status: string } | null;
}

const FILTERS: Array<[string, (o: OrderRow) => boolean]> = [
  ["All", () => true],
  ["Needs approval", (o) => o.status === "pending_approval"],
  ["Ready to send", (o) => o.status === "approved"],
  ["With buyer", (o) => o.status === "sent"],
  ["Won", (o) => o.status === "won"],
  ["Lost / rejected", (o) => o.status === "lost" || o.status === "rejected"],
];

export default function OrdersPage() {
  const { data, loading } = useApi<OrderRow[]>("/api/orders");
  const [f, setF] = useState(0);
  const [q, setQ] = useState("");
  const rows = useMemo(
    () => (data ?? []).filter(FILTERS[f][1]).filter((o) => !q || `${o.ref} ${o.customer.name} ${o.customer.company ?? ""} ${o.summary}`.toLowerCase().includes(q.toLowerCase())),
    [data, f, q],
  );
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Orders</div>
          <h1>Every enquiry, read and costed</h1>
          <p>Each row is a buyer message the agent turned into a requirement sheet and supplier comparison.</p>
        </div>
        <Link href="/desk/intake" className="btn btn-primary">
          <Icon.Plus size={16} /> New order
        </Link>
      </div>
      <div className="spread" style={{ marginBottom: 14, flexWrap: "wrap" }}>
        <div className="row wrap">
          {FILTERS.map(([label, fn], i) => (
            <button key={label} className={`btn btn-sm${i === f ? " btn-primary" : ""}`} onClick={() => setF(i)}>
              {label} <span className="num" style={{ opacity: 0.6 }}>{(data ?? []).filter(fn).length}</span>
            </button>
          ))}
        </div>
        <input className="input" style={{ maxWidth: 260 }} placeholder="Filter by buyer or ref…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="card table-scroll">
        {loading && !data ? (
          <div className="empty">
            <Spinner />
          </div>
        ) : rows.length === 0 ? (
          <div className="empty">No orders here yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Order</th>
                <th>Buyer</th>
                <th>What they need</th>
                <th>Read by</th>
                <th>Delivery</th>
                <th className="right">Quote</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id} className="clickable" onClick={() => (location.href = `/desk/orders/${o.id}`)}>
                  <td>
                    <Link href={`/desk/orders/${o.id}`} className="num" style={{ fontWeight: 600 }}>
                      {o.ref}
                    </Link>
                    <div className="faint" style={{ fontSize: 12 }}>{timeAgo(o.createdAt)}</div>
                  </td>
                  <td>
                    <b>{o.customer.company ?? o.customer.name}</b>
                    <div className="faint" style={{ fontSize: 12.5 }}>
                      {o.customer.company ? o.customer.name : ""} {o.customer.city ? `· ${o.customer.city}` : ""}
                    </div>
                  </td>
                  <td style={{ maxWidth: 340 }}>
                    <div style={{ fontSize: 13.5 }}>{o.summary}</div>
                    <div style={{ marginTop: 4 }}>
                      <SourceTag type={o.source} />
                    </div>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <span className="faint" style={{ fontSize: 12.5 }}>{o.engine === "claude" ? "Claude" : "Parser"}</span>
                      <Confidence value={o.confidence} />
                    </div>
                  </td>
                  <td className="num" style={{ fontSize: 13 }}>{fmtDate(o.deliveryBy, { day: "numeric", month: "short" })}</td>
                  <td className="right">
                    {o.quote ? (
                      <>
                        <div className="num" style={{ fontWeight: 600 }}>{inr(Math.round(o.quote.total))}</div>
                        <div className="faint num" style={{ fontSize: 12 }}>{o.quote.marginPct.toFixed(1)}% margin</div>
                      </>
                    ) : (
                      <span className="faint">—</span>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={o.status} />
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
