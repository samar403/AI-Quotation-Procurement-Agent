"use client";

import { useState } from "react";
import { CATEGORIES, type Category, type RequirementItem, type Unit } from "@/lib/types";
import { inr, qty, specLine, UNIT_LABEL } from "@/lib/format";
import { Icon } from "./icons";
import { Confidence, Swatch } from "./ui";

const UNITS: Unit[] = ["m", "kg", "pcs", "roll", "yard"];

export function RequirementSheet({ items, onSave, busy }: { items: RequirementItem[]; onSave: (items: RequirementItem[]) => Promise<boolean>; busy: boolean }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RequirementItem[]>(items);

  const start = () => {
    setDraft(structuredClone(items));
    setEditing(true);
  };
  const set = (i: number, patch: Partial<RequirementItem>) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const setSpec = (i: number, k: keyof RequirementItem["specs"], v: string) =>
    setDraft((d) => d.map((x, j) => (j === i ? { ...x, specs: { ...x.specs, [k]: k === "gsm" || k === "widthInch" ? (v ? Number(v) : undefined) : v || undefined } } : x)));

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <h3>Requirement sheet</h3>
          <div className="faint" style={{ fontSize: 12.5 }}>What the agent read. Check anything below 80% before approving.</div>
        </div>
        {editing ? (
          <div className="row">
            <button className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} disabled={busy}>
              Cancel
            </button>
            <button
              className="btn btn-primary btn-sm"
              disabled={busy}
              onClick={async () => {
                if (await onSave(draft)) setEditing(false);
              }}
            >
              {busy ? <span className="bobbin" /> : <Icon.Check size={15} />} Save & re-compare
            </button>
          </div>
        ) : (
          <button className="btn btn-sm" onClick={start}>
            <Icon.Edit size={15} /> Edit
          </button>
        )}
      </div>
      <div className="table-scroll">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 56 }} />
              <th>Product & specs</th>
              <th className="right">Quantity</th>
              <th className="right">Buyer target</th>
              <th>Read</th>
              {editing && <th />}
            </tr>
          </thead>
          <tbody>
            {(editing ? draft : items).map((it, i) => (
              <tr key={it.id || i}>
                <td>
                  <Swatch category={it.category} specs={it.specs} product={it.product} />
                </td>
                <td style={{ minWidth: 260 }}>
                  {editing ? (
                    <div className="stack" style={{ gap: 6 }}>
                      <div className="row">
                        <input className="input" value={it.product} onChange={(e) => set(i, { product: e.target.value })} aria-label="Product" />
                        <select className="select" style={{ width: 180 }} value={it.category} onChange={(e) => set(i, { category: e.target.value as Category })} aria-label="Category">
                          {CATEGORIES.map((c) => (
                            <option key={c}>{c}</option>
                          ))}
                        </select>
                      </div>
                      <div className="row wrap" style={{ gap: 6 }}>
                        {(
                          [
                            ["count", "Count"],
                            ["construction", "Constr."],
                            ["gsm", "GSM"],
                            ["widthInch", "Width″"],
                            ["color", "Colour"],
                            ["finish", "Finish"],
                            ["composition", "Composition"],
                          ] as const
                        ).map(([k, label]) => (
                          <input key={k} className="input" style={{ width: k === "composition" ? 150 : 92, height: 32, fontSize: 13 }} placeholder={label} aria-label={label} value={(it.specs[k] as string | number | undefined) ?? ""} onChange={(e) => setSpec(i, k, e.target.value)} />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <>
                      <b>{it.product}</b> <span className="faint" style={{ fontSize: 12 }}>· {it.category}</span>
                      <div className="muted" style={{ fontSize: 13 }}>{specLine(it.specs) || <span className="faint">No specs stated</span>}</div>
                      <div className="faint" style={{ fontSize: 12, fontStyle: "italic", marginTop: 2 }}>“{it.rawText}”</div>
                      {it.notes && <div style={{ fontSize: 12, color: "var(--madder)" }}>{it.notes}</div>}
                    </>
                  )}
                </td>
                <td className="right">
                  {editing ? (
                    <div className="row" style={{ justifyContent: "flex-end", gap: 6 }}>
                      <input className="input" type="number" min={0} style={{ width: 100 }} value={it.quantity} onChange={(e) => set(i, { quantity: Number(e.target.value) })} aria-label="Quantity" />
                      <select className="select" style={{ width: 76 }} value={it.unit} onChange={(e) => set(i, { unit: e.target.value as Unit })} aria-label="Unit">
                        {UNITS.map((u) => (
                          <option key={u} value={u}>
                            {UNIT_LABEL[u]}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <span className="num" style={{ fontWeight: 600 }}>
                      {qty(it.quantity)} {UNIT_LABEL[it.unit]}
                    </span>
                  )}
                </td>
                <td className="right">
                  {editing ? (
                    <input className="input" type="number" min={0} style={{ width: 90 }} value={it.targetPrice ?? ""} placeholder="—" onChange={(e) => set(i, { targetPrice: e.target.value ? Number(e.target.value) : null })} aria-label="Target price" />
                  ) : it.targetPrice ? (
                    <span className="num">{inr(it.targetPrice)}</span>
                  ) : (
                    <span className="faint">—</span>
                  )}
                </td>
                <td>
                  <Confidence value={it.confidence} />
                </td>
                {editing && (
                  <td>
                    <button className="btn btn-ghost btn-sm" aria-label="Remove item" onClick={() => setDraft((d) => d.filter((_, j) => j !== i))}>
                      <Icon.Trash size={15} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <div style={{ padding: "10px 14px", borderTop: "1px solid var(--rule)" }}>
          <button
            className="btn btn-sm"
            onClick={() => setDraft((d) => [...d, { id: "", rawText: "Added by hand", product: "Cotton Poplin", category: "Cotton Fabric", specs: {}, quantity: 1000, unit: "m", targetPrice: null, confidence: 1 }])}
          >
            <Icon.Plus size={15} /> Add line
          </button>
        </div>
      )}
    </div>
  );
}
