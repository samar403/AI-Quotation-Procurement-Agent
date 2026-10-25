"use client";

import { useState } from "react";
import { CATEGORIES, type Category, type Supplier } from "@/lib/types";
import { fmtDate, inr, specLine, timeAgo, UNIT_LABEL } from "@/lib/format";
import { Icon } from "@/components/icons";
import { api, Modal, Spinner, Swatch, useApi, useApp, useToast } from "@/components/ui";

const CSV_EXAMPLE = `supplier,product,price,unit,moq,stock,lead_time_days,gsm,width,count,composition,color,finish
Kavya Looms,Polyester Georgette,44.5,m,1000,15000,5,80,44,,100% polyester,,dyed
Narmada Textile Mills,Cotton Poplin,86,m,500,9000,8,110,58,40x40,100% cotton,white,RFD`;

function Ring({ v, label, color }: { v: number; label: string; color?: string }) {
  return (
    <div className="stack" style={{ alignItems: "center", gap: 4 }}>
      <div className="ring" style={{ ["--v" as string]: Math.round(v * 100), ["--rc" as string]: color }}>
        <span>{Math.round(v * 100)}</span>
      </div>
      <span className="faint" style={{ fontSize: 11 }}>{label}</span>
    </div>
  );
}

function SupplierForm({ initial, onDone }: { initial?: Supplier; onDone: () => void }) {
  const toast = useToast();
  const [f, setF] = useState<Partial<Supplier>>(initial ?? { name: "", city: "", state: "", contactName: "", phone: "", email: "", categories: [], onTimeRate: 0.85, qualityScore: 0.85, paymentTerms: "30 days credit", freightPerUnit: { m: 1.5, kg: 6 } });
  const set = (p: Partial<Supplier>) => setF((x) => ({ ...x, ...p }));
  const save = async () => {
    try {
      if (initial) await api(`/api/suppliers/${initial.id}`, { method: "PATCH", json: f });
      else await api("/api/suppliers", { method: "POST", json: f });
      toast(initial ? "Supplier updated" : "Supplier added");
      onDone();
    } catch (e) {
      toast((e as Error).message, true);
    }
  };
  return (
    <div className="stack" style={{ gap: 12 }}>
      <h3 style={{ fontSize: 20 }}>{initial ? `Edit ${initial.name}` : "Add a supplier"}</h3>
      <div className="grid g2" style={{ gap: 10 }}>
        <label className="field">Mill / supplier name<input className="input" value={f.name} onChange={(e) => set({ name: e.target.value })} /></label>
        <label className="field">Contact person<input className="input" value={f.contactName} onChange={(e) => set({ contactName: e.target.value })} /></label>
        <label className="field">City<input className="input" value={f.city} onChange={(e) => set({ city: e.target.value })} /></label>
        <label className="field">WhatsApp / phone<input className="input" value={f.phone} onChange={(e) => set({ phone: e.target.value })} /></label>
        <label className="field">Email<input className="input" value={f.email} onChange={(e) => set({ email: e.target.value })} /></label>
        <label className="field">Payment terms<input className="input" value={f.paymentTerms} onChange={(e) => set({ paymentTerms: e.target.value })} /></label>
        <label className="field">On-time delivery %<input className="input" type="number" min={0} max={100} value={Math.round((f.onTimeRate ?? 0) * 100)} onChange={(e) => set({ onTimeRate: Number(e.target.value) / 100 })} /></label>
        <label className="field">Quality score %<input className="input" type="number" min={0} max={100} value={Math.round((f.qualityScore ?? 0) * 100)} onChange={(e) => set({ qualityScore: Number(e.target.value) / 100 })} /></label>
        <label className="field">Freight ₹/m<input className="input" type="number" step="0.1" value={f.freightPerUnit?.m ?? ""} onChange={(e) => set({ freightPerUnit: { ...f.freightPerUnit, m: Number(e.target.value) } })} /></label>
        <label className="field">Freight ₹/kg<input className="input" type="number" step="0.1" value={f.freightPerUnit?.kg ?? ""} onChange={(e) => set({ freightPerUnit: { ...f.freightPerUnit, kg: Number(e.target.value) } })} /></label>
      </div>
      <div className="field">
        Deals in
        <div className="row wrap" style={{ gap: 6 }}>
          {CATEGORIES.map((c) => {
            const on = f.categories?.includes(c);
            return (
              <button key={c} type="button" className={`btn btn-sm${on ? " btn-primary" : ""}`} onClick={() => set({ categories: on ? f.categories!.filter((x) => x !== c) : [...(f.categories ?? []), c as Category] })}>
                {c}
              </button>
            );
          })}
        </div>
      </div>
      <div className="row" style={{ justifyContent: "flex-end" }}>
        <button className="btn btn-primary" onClick={save}>
          <Icon.Check size={16} /> Save
        </button>
      </div>
    </div>
  );
}

export default function SuppliersPage() {
  const toast = useToast();
  const { bump } = useApp();
  const { data, reload } = useApi<Supplier[]>("/api/suppliers");
  const [open, setOpen] = useState<string | null>(null);
  const [form, setForm] = useState<Supplier | "new" | null>(null);
  const [csv, setCsv] = useState<string | null>(null);
  const [cat, setCat] = useState<string>("All");

  const list = (data ?? []).filter((s) => cat === "All" || s.categories.includes(cat as Category));
  const done = () => {
    setForm(null);
    reload();
    bump();
  };

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Supplier network</div>
          <h1>Your mills & their price lists</h1>
          <p>The agent compares every requirement against these catalogs. Keep rates fresh by importing the price list a mill sends you each week.</p>
        </div>
        <div className="row wrap">
          <button className="btn" onClick={() => setCsv(CSV_EXAMPLE)}>
            <Icon.Upload size={16} /> Import price list
          </button>
          <button className="btn btn-primary" onClick={() => setForm("new")}>
            <Icon.Plus size={16} /> Add supplier
          </button>
        </div>
      </div>

      <div className="row wrap" style={{ marginBottom: 16 }}>
        {["All", ...CATEGORIES].map((c) => (
          <button key={c} className={`btn btn-sm${cat === c ? " btn-primary" : ""}`} onClick={() => setCat(c)}>
            {c}
          </button>
        ))}
      </div>

      {!data ? (
        <div className="empty">
          <Spinner />
        </div>
      ) : (
        <div className="grid g3">
          {list.map((s) => (
            <div key={s.id} className="card sup-card">
              <div className="spread" style={{ alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <b style={{ fontSize: 16 }}>{s.name}</b>
                  <div className="faint" style={{ fontSize: 12.5 }}>
                    {s.city}
                    {s.state ? `, ${s.state}` : ""} · {s.contactName}
                  </div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <Ring v={s.onTimeRate} label="on-time" />
                  <Ring v={s.qualityScore} label="quality" color="var(--indigo)" />
                </div>
              </div>
              <div className="row wrap" style={{ gap: 5 }}>
                {s.categories.map((c) => (
                  <span className="cat-chip" key={c}>{c}</span>
                ))}
              </div>
              {s.notes && <div className="muted" style={{ fontSize: 13 }}>{s.notes}</div>}
              <div className="spread" style={{ fontSize: 12.5 }}>
                <span className="faint">
                  {s.catalog.length} SKUs · {s.paymentTerms}
                </span>
                <div className="row" style={{ gap: 4 }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => setOpen(open === s.id ? null : s.id)}>
                    {open === s.id ? "Hide" : "Price list"}
                  </button>
                  <button className="btn btn-ghost btn-sm" aria-label={`Edit ${s.name}`} onClick={() => setForm(s)}>
                    <Icon.Edit size={15} />
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    aria-label={`Remove ${s.name}`}
                    onClick={async () => {
                      if (!confirm(`Remove ${s.name} from your network?`)) return;
                      await api(`/api/suppliers/${s.id}`, { method: "DELETE" });
                      done();
                    }}
                  >
                    <Icon.Trash size={15} />
                  </button>
                </div>
              </div>
              {open === s.id && (
                <div className="stack" style={{ gap: 8, borderTop: "1px dashed var(--rule)", paddingTop: 10 }}>
                  {s.catalog.map((c) => (
                    <div key={c.id} className="row" style={{ gap: 10, fontSize: 13 }}>
                      <Swatch category={c.category} specs={c.specs} product={c.product} size="sm" />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <b>{c.product}</b>
                        <div className="faint" style={{ fontSize: 11.5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{specLine(c.specs)}</div>
                      </div>
                      <div className="right">
                        <div className="num" style={{ fontWeight: 600 }}>
                          {inr(c.price)}/{UNIT_LABEL[c.unit]}
                        </div>
                        <div className="faint num" style={{ fontSize: 11 }} title={`Updated ${fmtDate(c.updatedAt)}`}>
                          MOQ {c.moq} · {c.leadTimeDays}d · {timeAgo(c.updatedAt)}
                        </div>
                      </div>
                    </div>
                  ))}
                  {!s.catalog.length && <div className="faint">No price list yet — import one.</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={form !== null} onClose={() => setForm(null)}>
        {form && <SupplierForm initial={form === "new" ? undefined : form} onDone={done} />}
      </Modal>

      <Modal open={csv !== null} onClose={() => setCsv(null)}>
        <h3 style={{ fontSize: 20 }}>Import a price list</h3>
        <p className="muted" style={{ fontSize: 13.5 }}>
          Paste CSV rows (or load a .csv file). New suppliers are created automatically; existing SKUs are updated. Columns: <span className="mono" style={{ fontSize: 12 }}>supplier, product, price</span> are required.
        </p>
        <textarea className="textarea mono" rows={8} style={{ fontSize: 12 }} value={csv ?? ""} onChange={(e) => setCsv(e.target.value)} />
        <div className="spread" style={{ marginTop: 12 }}>
          <label className="btn btn-sm">
            <Icon.Upload size={15} /> Load .csv
            <input type="file" accept=".csv,text/csv" hidden onChange={async (e) => setCsv(await e.target.files?.[0]?.text() ?? csv)} />
          </label>
          <button
            className="btn btn-primary"
            onClick={async () => {
              try {
                const r = await api<{ added: number; updated: number; errors: string[] }>("/api/suppliers/import", { method: "POST", body: csv ?? "" });
                toast(`Imported: ${r.added} new, ${r.updated} updated${r.errors.length ? ` · ${r.errors.length} rows skipped` : ""}`, r.errors.length > 0);
                setCsv(null);
                done();
              } catch (e) {
                toast((e as Error).message, true);
              }
            }}
          >
            Import
          </button>
        </div>
      </Modal>
    </>
  );
}
