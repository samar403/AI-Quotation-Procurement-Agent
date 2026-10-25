"use client";

import Link from "next/link";
import { use } from "react";
import type { Quote, Settings } from "@/lib/types";
import { Icon } from "@/components/icons";
import { Spinner, useApi, useApp } from "@/components/ui";
import { ApprovalPanel, QuoteSheet } from "@/components/QuoteSheet";

export default function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { bump } = useApp();
  const { data, error, setData } = useApi<{ quote: Quote; settings: Settings }>(`/api/quotes/${id}`);
  if (error) return <div className="empty">{error}</div>;
  if (!data) return <div className="empty"><Spinner /></div>;
  const onChange = (q: Quote) => {
    setData((d) => (d ? { ...d, quote: q } : d));
    bump();
  };
  return (
    <>
      <div className="page-head no-print">
        <div>
          <div className="row" style={{ gap: 8 }}>
            <Link href="/desk/quotes" className="eyebrow">← Quotations</Link>
            <span className="eyebrow">/ {data.quote.number}</span>
          </div>
          <h1 style={{ marginTop: 4 }}>{data.quote.customer.company ?? data.quote.customer.name}</h1>
        </div>
        <div className="row wrap">
          <Link className="btn" href={`/desk/orders/${data.quote.orderId}`}>
            <Icon.Inbox size={16} /> Order workspace
          </Link>
          <button className="btn" onClick={() => window.print()}>
            Print
          </button>
          <a className="btn btn-primary" href={`/api/quotes/${data.quote.id}/pdf`}>
            <Icon.Download size={16} /> Download PDF
          </a>
        </div>
      </div>
      <div className="ws-grid">
        <QuoteSheet quote={data.quote} settings={data.settings} onChange={onChange} />
        <div className="ws-side no-print">
          <ApprovalPanel quote={data.quote} onChange={onChange} />
        </div>
      </div>
    </>
  );
}
