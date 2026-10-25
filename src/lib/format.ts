// Whole rupees print without decimals; anything with paise prints both digits (₹94.50, not ₹94.5).
export const inr = (n: number, frac = Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2) =>
  `₹${n.toLocaleString("en-IN", { minimumFractionDigits: frac, maximumFractionDigits: Math.max(frac, 2) })}`;

export const inrCompact = (n: number) => {
  if (Math.abs(n) >= 1e7) return `₹${(n / 1e7).toFixed(2)} Cr`;
  if (Math.abs(n) >= 1e5) return `₹${(n / 1e5).toFixed(2)} L`;
  if (Math.abs(n) >= 1e3) return `₹${(n / 1e3).toFixed(1)}k`;
  return `₹${Math.round(n)}`;
};

export const qty = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

export const UNIT_LABEL: Record<string, string> = { m: "m", kg: "kg", pcs: "pcs", roll: "rolls", yard: "yd" };

export function fmtDate(iso?: string | null, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("en-IN", opts);
}

export function timeAgo(iso: string, now = Date.now()) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export function specLine(s: { composition?: string; gsm?: number; widthInch?: number; count?: string; construction?: string; color?: string; finish?: string }) {
  return [s.count, s.construction, s.gsm ? `${s.gsm} GSM` : "", s.widthInch ? `${s.widthInch}"` : "", s.composition, s.color, s.finish]
    .filter(Boolean)
    .join(" · ");
}

export function duration(ms: number) {
  if (ms < 1000) return `${Math.max(1, Math.round(ms))} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}
