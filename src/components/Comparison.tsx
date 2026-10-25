"use client";

import type { ItemComparison, RequirementItem } from "@/lib/types";
import { inr, qty, specLine, UNIT_LABEL } from "@/lib/format";
import { Swatch } from "./ui";

// Selvedge bars: each offer's landed cost on a shared min→max scale, with the market average
// as a thin tick. Score is shown as a dye-drop ring.
export function ComparisonPanel({ items, comparisons, onSelect, busy }: { items: RequirementItem[]; comparisons: ItemComparison[]; onSelect: (itemId: string, supplierId: string) => void; busy: boolean }) {
  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3>Supplier comparison</h3>
          <div className="faint" style={{ fontSize: 12.5 }}>Landed cost = mill price + freight. Score weighs price, lead time vs. deadline, reliability and MOQ fit.</div>
        </div>
      </div>
      {items.map((item) => {
        const c = comparisons.find((x) => x.itemId === item.id);
        const offers = c?.offers ?? [];
        const min = Math.min(...offers.map((o) => o.landedCost));
        const max = Math.max(...offers.map((o) => o.landedCost));
        const span = max - min || 1;
        const pos = (v: number) => (offers.length > 1 ? 6 + ((v - min) / span) * 88 : 50);
        return (
          <div className="item-block" key={item.id}>
            <div className="item-head">
              <Swatch category={item.category} specs={item.specs} product={item.product} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <b>{item.product}</b> <span className="faint num">· {qty(item.quantity)} {UNIT_LABEL[item.unit]}</span>
                <div className="faint" style={{ fontSize: 12.5 }}>{specLine(item.specs) || "No specs stated"}</div>
              </div>
              {c?.savingsVsAverage ? <span className="badge b-mehendi">saves {inr(c.savingsVsAverage)}</span> : null}
            </div>
            {offers.length === 0 ? (
              <div className="reason" style={{ borderLeftColor: "var(--madder)" }}>{c?.reason ?? "No offers."}</div>
            ) : (
              <>
                {offers.map((o) => {
                  const selected = c?.selectedSupplierId === o.supplierId;
                  const recommended = c?.recommendedSupplierId === o.supplierId;
                  const sc = o.score >= 80 ? "var(--mehendi)" : o.score >= 65 ? "var(--turmeric)" : "var(--madder)";
                  return (
                    <div
                      key={o.supplierId}
                      className={`offer${selected ? " selected" : ""}`}
                      role="radio"
                      aria-checked={selected}
                      tabIndex={0}
                      onClick={() => !busy && !selected && onSelect(item.id, o.supplierId)}
                      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && !busy && !selected && onSelect(item.id, o.supplierId)}
                    >
                      <span className="radio" />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {o.supplierName}
                        </div>
                        <div className="faint" style={{ fontSize: 12 }}>
                          {recommended && <b style={{ color: "var(--indigo)" }}>✦ agent pick · </b>}
                          {o.city} · {o.sku}
                        </div>
                        {o.flags.length > 0 && <div className="flag">{o.flags.join(" · ")}</div>}
                      </div>
                      <div className="pricebar hide-md" title={`Market average ${inr(c?.marketAverage ?? 0)}`}>
                        <div className="track" />
                        <div className="fill" style={{ left: `${pos(o.landedCost)}%` }} />
                        {c?.marketAverage && offers.length > 1 ? <div className="avg" style={{ left: `${pos(c.marketAverage)}%` }} /> : null}
                      </div>
                      <div className="right">
                        <div className="num" style={{ fontWeight: 600 }}>{inr(o.landedCost)}</div>
                        <div className="faint num" style={{ fontSize: 11.5 }}>
                          {inr(o.unitPrice)} + {inr(o.freightPerUnit)}
                        </div>
                      </div>
                      <div className="right num" style={{ fontSize: 12.5 }}>
                        <div>{o.leadTimeDays}d</div>
                        <div className="faint">lead</div>
                      </div>
                      <div className="right num hide-md" style={{ fontSize: 12.5 }}>
                        <div>{Math.round(o.breakdown.reliability * 100)}%</div>
                        <div className="faint">reliable</div>
                      </div>
                      <div className="hide-md" style={{ display: "flex", justifyContent: "flex-end" }}>
                        <span className="scoredrop" style={{ ["--v" as string]: o.score, ["--sc" as string]: sc }} title={`Price ${o.breakdown.price} · Lead ${o.breakdown.lead} · Reliability ${o.breakdown.reliability} · MOQ ${o.breakdown.moq} · Spec match ${o.breakdown.match}`}>
                          <span>{Math.round(o.score)}</span>
                        </span>
                      </div>
                    </div>
                  );
                })}
                <div className="reason">{c?.reason}</div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
}
