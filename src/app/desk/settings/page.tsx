"use client";

import { useEffect, useState } from "react";
import { CATEGORIES, type Settings } from "@/lib/types";
import { PLANS, planFor } from "@/lib/plans";
import { fmtDate } from "@/lib/format";
import { Icon } from "@/components/icons";
import { api, Spinner, useApi, useApp, useToast } from "@/components/ui";

function Num({ label, value, onChange, step = 1, suffix }: { label: string; value: number; onChange: (n: number) => void; step?: number; suffix?: string }) {
  return (
    <label className="field">
      {label}
      <div className="row" style={{ gap: 6 }}>
        <input className="input num" type="number" step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
        {suffix && <span className="faint" style={{ fontSize: 13 }}>{suffix}</span>}
      </div>
    </label>
  );
}

export default function SettingsPage() {
  const toast = useToast();
  const { bump, ai } = useApp();
  const { data } = useApi<Settings>("/api/settings");
  const [s, setS] = useState<Settings | null>(null);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);
  useEffect(() => {
    if (data) setS(structuredClone(data));
  }, [data]);
  if (!s) return <div className="empty"><Spinner /></div>;

  const save = async (patch: Partial<Settings> = s, msg = "Settings saved — new quotes use these rules") => {
    setSaving(true);
    try {
      const next = await api<Settings>("/api/settings", { method: "PATCH", json: patch });
      setS(next);
      bump();
      toast(msg);
    } catch (e) {
      toast((e as Error).message, true);
    } finally {
      setSaving(false);
    }
  };
  const plan = planFor(s.plan.tier);
  const wTotal = s.weights.price + s.weights.lead + s.weights.reliability + s.weights.moq || 1;

  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Settings</div>
          <h1>Your rules of the trade</h1>
          <p>Margins, approval guardrails and how suppliers are scored. The agent applies these to every quote it drafts.</p>
        </div>
        <button className="btn btn-primary" disabled={saving} onClick={() => save()}>
          {saving ? <span className="bobbin" /> : <Icon.Check size={16} />} Save changes
        </button>
      </div>

      <div className="stack" style={{ gap: 20 }}>
        <div className="grid g2">
          <div className="card">
            <div className="card-head"><h3>Margins & pricing</h3></div>
            <div className="card-pad stack" style={{ gap: 14 }}>
              <div className="grid g3" style={{ gap: 10 }}>
                <Num label="Default margin" suffix="%" step={0.5} value={s.pricing.defaultMarginPct} onChange={(n) => setS({ ...s, pricing: { ...s.pricing, defaultMarginPct: n } })} />
                <Num label="Never below" suffix="%" step={0.5} value={s.pricing.minMarginPct} onChange={(n) => setS({ ...s, pricing: { ...s.pricing, minMarginPct: n } })} />
                <Num label="GST" suffix="%" step={0.5} value={s.pricing.taxRate} onChange={(n) => setS({ ...s, pricing: { ...s.pricing, taxRate: n } })} />
                <Num label="Round rates up to" suffix="₹" step={0.25} value={s.pricing.roundTo} onChange={(n) => setS({ ...s, pricing: { ...s.pricing, roundTo: n } })} />
                <Num label="Quote validity" suffix="days" value={s.pricing.quoteValidityDays} onChange={(n) => setS({ ...s, pricing: { ...s.pricing, quoteValidityDays: n } })} />
              </div>
              <div>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Margin by category</div>
                <div className="grid g2" style={{ gap: 8 }}>
                  {CATEGORIES.map((c) => (
                    <div key={c} className="spread" style={{ fontSize: 13.5 }}>
                      <span>{c}</span>
                      <input
                        className="margin-input"
                        value={s.pricing.categoryMargins[c] ?? s.pricing.defaultMarginPct}
                        onChange={(e) => setS({ ...s, pricing: { ...s.pricing, categoryMargins: { ...s.pricing.categoryMargins, [c]: Number(e.target.value) } } })}
                        aria-label={`Margin for ${c}`}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-head"><h3>Approval guardrails</h3></div>
            <div className="card-pad stack" style={{ gap: 14 }}>
              <p className="muted" style={{ margin: 0, fontSize: 13.5 }}>Quotes inside every guardrail are auto-approved and ready to send. Anything outside waits for one of your approvers.</p>
              <div className="grid g3" style={{ gap: 10 }}>
                <Num label="Auto-approve below" suffix="₹" step={5000} value={s.approval.autoApproveBelow} onChange={(n) => setS({ ...s, approval: { ...s.approval, autoApproveBelow: n } })} />
                <Num label="Flag margin under" suffix="%" step={0.5} value={s.approval.requireApprovalIfMarginBelow} onChange={(n) => setS({ ...s, approval: { ...s.approval, requireApprovalIfMarginBelow: n } })} />
                <Num label="Flag reading under" suffix="%" value={Math.round(s.approval.requireApprovalIfConfidenceBelow * 100)} onChange={(n) => setS({ ...s, approval: { ...s.approval, requireApprovalIfConfidenceBelow: n / 100 } })} />
              </div>
              <label className="field">
                Approvers (comma-separated)
                <input className="input" value={s.approval.approvers.join(", ")} onChange={(e) => setS({ ...s, approval: { ...s.approval, approvers: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) } })} />
              </label>
              <div className="eyebrow" style={{ marginTop: 6 }}>How suppliers are scored</div>
              {(
                [
                  ["price", "Landed price"],
                  ["lead", "Lead time vs. deadline"],
                  ["reliability", "On-time & quality record"],
                  ["moq", "MOQ & stock fit"],
                ] as const
              ).map(([k, label]) => (
                <div key={k} className="row" style={{ gap: 12, fontSize: 13.5 }}>
                  <span style={{ width: 190 }}>{label}</span>
                  <input className="slider" type="range" min={0} max={1} step={0.05} value={s.weights[k]} onChange={(e) => setS({ ...s, weights: { ...s.weights, [k]: Number(e.target.value) } })} />
                  <span className="num faint" style={{ width: 44, textAlign: "right" }}>{Math.round((s.weights[k] / wTotal) * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head"><h3>Business profile (printed on quotations)</h3></div>
          <div className="card-pad grid g3" style={{ gap: 12 }}>
            {(
              [
                ["name", "Trading name"],
                ["tagline", "Tagline"],
                ["gstin", "GSTIN"],
                ["phone", "Phone"],
                ["email", "Email"],
                ["signatory", "Authorised signatory"],
              ] as const
            ).map(([k, label]) => (
              <label className="field" key={k}>
                {label}
                <input className="input" value={s.business[k]} onChange={(e) => setS({ ...s, business: { ...s.business, [k]: e.target.value } })} />
              </label>
            ))}
            <label className="field" style={{ gridColumn: "span 2" }}>
              Address
              <input className="input" value={s.business.address} onChange={(e) => setS({ ...s, business: { ...s.business, address: e.target.value } })} />
            </label>
            <label className="field">
              Bank details
              <input className="input" value={s.business.bank} onChange={(e) => setS({ ...s, business: { ...s.business, bank: e.target.value } })} />
            </label>
          </div>
        </div>

        <div className="card" id="plan">
          <div className="card-head">
            <div>
              <h3>Plan & billing</h3>
              <div className="faint" style={{ fontSize: 12.5 }}>
                Billing period started {fmtDate(s.plan.periodStart)} · {s.plan.docsUsed} of {plan.docsLimit} orders read
              </div>
            </div>
            <span className="badge b-indigo">{plan.name}</span>
          </div>
          <div className="card-pad grid g3">
            {PLANS.map((p) => (
              <div key={p.id} className={`card price-card${p.id === s.plan.tier ? " hl" : ""}`} style={{ boxShadow: "none" }}>
                <div className="spread">
                  <b style={{ fontSize: 18 }}>{p.name}</b>
                  {p.id === s.plan.tier && <span className="badge b-mehendi">Current</span>}
                </div>
                <div>
                  <span className="price-big" style={{ fontSize: 34 }}>₹{p.priceMonthly.toLocaleString("en-IN")}</span>
                  <span className="faint"> /month</span>
                </div>
                <ul>
                  {p.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
                {p.id !== s.plan.tier && (
                  <button className="btn" onClick={() => save({ plan: { ...s.plan, tier: p.id } }, `Switched to ${p.name}. Prorated on your next invoice.`)}>
                    Switch to {p.name}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="card card-pad spread" style={{ flexWrap: "wrap" }}>
          <div>
            <b>AI reading</b>
            <div className="muted" style={{ fontSize: 13.5 }}>
              {ai?.ai
                ? `Connected — requirements are read by ${ai.model}. Photos, scanned PDFs and messy multi-message chats are supported.`
                : "Running on the built-in textile parser. Add ANTHROPIC_API_KEY to the server environment to read photos, scans and messy chats with Claude."}
            </div>
          </div>
          <button
            className="btn"
            disabled={resetting}
            onClick={async () => {
              if (!confirm("Reset the workspace to the demo data? Your orders, quotes and edits will be replaced.")) return;
              setResetting(true);
              try {
                await api("/api/demo/reset", { method: "POST" });
                bump();
                toast("Demo workspace restored");
                location.href = "/desk";
              } catch (e) {
                toast((e as Error).message, true);
              } finally {
                setResetting(false);
              }
            }}
          >
            {resetting ? <span className="bobbin" /> : null} Reset demo data
          </button>
        </div>
      </div>
    </>
  );
}
