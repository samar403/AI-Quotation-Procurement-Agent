"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/icons";
import { SourceTag, Spinner, useApi } from "@/components/ui";
import { inr, inrCompact, timeAgo } from "@/lib/format";
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
  quote: { id: string; number: string; total: number; marginPct: number; status: string } | null;
}
interface Stats {
  orders: number;
  quotes: number;
  pendingApproval: number;
  winRate: number | null;
  wonValue: number;
  avgMarginPct: number;
  avgTurnaroundSec: number;
  savings: number;
  pipeline: number;
  days: Array<{ day: string; quotes: number; value: number }>;
}

const COLS = ["Received", "Read", "Quoted", "Approved", "Sent", "Won"];
const POS: Record<OrderStatus, [number, string, string]> = {
  extracted: [1, "var(--kasturi)", "Needs prices"],
  quoted: [2, "var(--indigo)", "Quoted"],
  pending_approval: [2, "var(--turmeric)", "Needs approval"],
  approved: [3, "var(--mehendi)", "Ready to send"],
  sent: [4, "var(--indigo)", "With buyer"],
  won: [5, "var(--mehendi)", "Won"],
  lost: [4, "var(--madder)", "Lost"],
  rejected: [2, "var(--madder)", "Rejected"],
};

function LoomBoard({ orders }: { orders: OrderRow[] }) {
  const router = useRouter();
  return (
    <div className="card board">
      <div className="board-cols">
        <div>Buyer</div>
        {COLS.map((c) => (
          <div key={c}>{c}</div>
        ))}
      </div>
      {orders.length === 0 && (
        <div className="empty">
          The loom is empty. <Link href="/desk/intake" style={{ textDecoration: "underline" }}>Drop in your first order</Link>.
        </div>
      )}
      {orders.slice(0, 12).map((o, i) => {
        const [idx, color, tag] = POS[o.status];
        const pct = ((idx + 0.5) / COLS.length) * 100;
        return (
          <div key={o.id} className="thread-row" role="link" tabIndex={0} style={{ cursor: "pointer" }} onClick={() => router.push(`/desk/orders/${o.id}`)} onKeyDown={(e) => e.key === "Enter" && router.push(`/desk/orders/${o.id}`)}>
            <div className="thread-who">
              <b>{o.customer.company ?? o.customer.name}</b>
              <small>
                {o.ref} · {timeAgo(o.createdAt)}
              </small>
            </div>
            <div className="thread-track" style={{ ["--tc" as string]: color }}>
              <div className="thread-line" style={{ width: `${pct}%`, animationDelay: `${i * 70}ms` }} />
              <div className="thread-knot" style={{ left: `${pct}%`, animationDelay: `${1000 + i * 70}ms` }} />
              <div className={`thread-tag${pct > 70 ? " flip" : ""}`} style={{ left: `${pct}%`, animationDelay: `${1100 + i * 70}ms` }}>
                {tag}
                {o.quote ? <span className="faint num"> · {inrCompact(o.quote.total)}</span> : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Bars({ days }: { days: Stats["days"] }) {
  const max = Math.max(1, ...days.map((d) => d.value));
  return (
    <svg viewBox="0 0 280 90" width="100%" height="110" preserveAspectRatio="none" role="img" aria-label="Quotation value, last 14 days">
      {days.map((d, i) => {
        const h = Math.max(2, (d.value / max) * 70);
        return (
          <g key={d.day}>
            <title>{`${d.day}: ${d.quotes} quotes, ${inr(d.value)}`}</title>
            <rect x={i * 20 + 3} y={80 - h} width={13} height={h} rx={3} fill={d.value ? "var(--indigo)" : "var(--rule)"} opacity={d.value ? 0.9 : 1} />
            {d.value ? <rect x={i * 20 + 3} y={80 - h} width={13} height={3} rx={1.5} fill="var(--turmeric)" /> : null}
          </g>
        );
      })}
      <line x1="0" x2="280" y1="81.5" y2="81.5" stroke="var(--rule-2)" />
    </svg>
  );
}

export default function Dashboard() {
  const { data: orders } = useApi<OrderRow[]>("/api/orders");
  const { data: stats } = useApi<Stats>("/api/stats");
  const pending = (orders ?? []).filter((o) => o.status === "pending_approval");

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">{new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })}</div>
          <h1>Today on the loom</h1>
          <p>Every buyer enquiry is a thread. Watch it travel from a forwarded message to a won order.</p>
        </div>
        <Link href="/desk/intake" className="btn btn-primary btn-lg">
          <Icon.Spark /> Read a new order
        </Link>
      </div>

      {!stats || !orders ? (
        <div className="empty">
          <Spinner />
        </div>
      ) : (
        <div className="stack" style={{ gap: 22 }}>
          <div className="grid g4">
            <div className="card stat" style={{ ["--accent" as string]: "var(--turmeric)" }}>
              <div className="label">Waiting for your approval</div>
              <div className="value">{stats.pendingApproval}</div>
              <div className="hint">{inrCompact(stats.pipeline)} in open quotes</div>
            </div>
            <div className="card stat" style={{ ["--accent" as string]: "var(--indigo)" }}>
              <div className="label">Message → quote</div>
              <div className="value">
                {stats.avgTurnaroundSec < 1 ? "<1s" : stats.avgTurnaroundSec < 60 ? `${stats.avgTurnaroundSec.toFixed(1)}s` : `${(stats.avgTurnaroundSec / 60).toFixed(1)}m`}
              </div>
              <div className="hint">vs ~2–4 hours by phone & calculator</div>
            </div>
            <div className="card stat" style={{ ["--accent" as string]: "var(--mehendi)" }}>
              <div className="label">Bought below market average</div>
              <div className="value">{inrCompact(stats.savings)}</div>
              <div className="hint">across {stats.orders} orders compared</div>
            </div>
            <div className="card stat" style={{ ["--accent" as string]: "var(--madder)" }}>
              <div className="label">Average margin · win rate</div>
              <div className="value">
                {stats.avgMarginPct.toFixed(1)}%<span className="faint" style={{ fontSize: 20 }}> · {stats.winRate == null ? "—" : `${Math.round(stats.winRate * 100)}%`}</span>
              </div>
              <div className="hint">{inrCompact(stats.wonValue)} won so far</div>
            </div>
          </div>

          <LoomBoard orders={orders} />

          <div className="grid g2">
            <div className="card">
              <div className="card-head">
                <h3>Needs your eye</h3>
                <Link href="/desk/quotes" className="btn btn-ghost btn-sm">
                  All quotations <Icon.Arrow size={15} />
                </Link>
              </div>
              {pending.length === 0 ? (
                <div className="empty">Nothing waiting. Every quote is inside your guardrails. ✦</div>
              ) : (
                <table className="table">
                  <tbody>
                    {pending.map((o) => (
                      <tr key={o.id} className="clickable" onClick={() => (location.href = `/desk/orders/${o.id}`)}>
                        <td>
                          <b>{o.customer.company ?? o.customer.name}</b>
                          <div className="faint" style={{ fontSize: 12.5 }}>{o.summary}</div>
                        </td>
                        <td className="right">
                          <div className="num">{o.quote ? inr(Math.round(o.quote.total)) : "—"}</div>
                          <SourceTag type={o.source} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="card card-pad">
              <div className="spread">
                <h3 style={{ fontSize: 18 }}>Quotation value, last 14 days</h3>
                <span className="faint num">{stats.quotes} total</span>
              </div>
              <div style={{ marginTop: 18 }}>
                <Bars days={stats.days} />
              </div>
              <div className="spread faint" style={{ fontSize: 12, marginTop: 4 }}>
                <span>{new Date(stats.days[0].day).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                <span>Today</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
