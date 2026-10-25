"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Category, OrderStatus, QuoteStatus, SourceType, Specs } from "@/lib/types";
import { Icon } from "./icons";

// ───────── Toasts ─────────
type Toast = { id: number; text: string; err?: boolean };
const ToastCtx = createContext<(text: string, err?: boolean) => void>(() => undefined);
export const useToast = () => useContext(ToastCtx);

// ───────── App context (who is acting, AI status) ─────────
interface AppState {
  actor: string;
  setActor: (a: string) => void;
  approvers: string[];
  ai: { ai: boolean; model: string | null } | null;
  refreshKey: number;
  bump: () => void;
}
const AppCtx = createContext<AppState>({ actor: "You", setActor: () => undefined, approvers: [], ai: null, refreshKey: 0, bump: () => undefined });
export const useApp = () => useContext(AppCtx);

export function Providers({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, err?: boolean) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, err }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);
  const [actor, setActorState] = useState("Mahesh Agarwal");
  const [approvers, setApprovers] = useState<string[]>([]);
  const [ai, setAi] = useState<AppState["ai"]>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    try {
      const a = localStorage.getItem("taana-actor");
      if (a) setActorState(a);
    } catch {}
    fetch("/api/health").then((r) => r.json()).then(setAi).catch(() => undefined);
    fetch("/api/settings").then((r) => r.json()).then((s) => setApprovers([...(s.approval?.approvers ?? []), "Sales desk"])).catch(() => undefined);
  }, [refreshKey]);
  const setActor = (a: string) => {
    setActorState(a);
    try {
      localStorage.setItem("taana-actor", a);
    } catch {}
  };
  const value = useMemo(() => ({ actor, setActor, approvers, ai, refreshKey, bump: () => setRefreshKey((k) => k + 1) }), [actor, approvers, ai, refreshKey]);
  return (
    <AppCtx.Provider value={value}>
      <ToastCtx.Provider value={push}>
        {children}
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast${t.err ? " err" : ""}`}>
              {t.text}
            </div>
          ))}
        </div>
      </ToastCtx.Provider>
    </AppCtx.Provider>
  );
}

// ───────── Data fetching ─────────
export async function api<T>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: init?.json !== undefined ? { "Content-Type": "application/json", ...init?.headers } : init?.headers,
    body: init?.json !== undefined ? JSON.stringify(init.json) : init?.body,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

export function useApi<T>(url: string | null) {
  const { refreshKey } = useApp();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!url) return;
    const n = ++seq.current;
    setLoading(true);
    try {
      const d = await api<T>(url);
      if (n === seq.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (n === seq.current) setError((e as Error).message);
    } finally {
      if (n === seq.current) setLoading(false);
    }
  }, [url]);
  useEffect(() => {
    load();
  }, [load, refreshKey]);
  return { data, error, loading, reload: load, setData };
}

// ───────── Status badges ─────────
const STATUS: Record<string, [string, string]> = {
  extracted: ["Read", "b-indigo"],
  quoted: ["Quoted", "b-indigo"],
  draft: ["Draft", ""],
  pending_approval: ["Needs approval", "b-turmeric"],
  approved: ["Approved", "b-mehendi"],
  rejected: ["Rejected", "b-madder"],
  sent: ["Sent to buyer", "b-indigo"],
  won: ["Won", "b-mehendi"],
  lost: ["Lost", "b-madder"],
};
export function StatusBadge({ status }: { status: OrderStatus | QuoteStatus }) {
  const [label, cls] = STATUS[status] ?? [status, ""];
  return <span className={`badge ${cls}`}>{label}</span>;
}

export const SOURCE_META: Record<SourceType, { label: string; icon: (p: { size?: number }) => ReactNode }> = {
  whatsapp: { label: "WhatsApp", icon: Icon.Chat },
  email: { label: "Email", icon: Icon.Mail },
  pdf: { label: "PDF", icon: Icon.Pdf },
  image: { label: "Photo", icon: Icon.Image },
  text: { label: "Text", icon: Icon.Receipt },
};

export function SourceTag({ type }: { type: SourceType }) {
  const m = SOURCE_META[type];
  const I = m.icon;
  return (
    <span className="source-pill">
      <I size={14} /> {m.label}
    </span>
  );
}

// ───────── Fabric swatches ─────────
const COLOR_HEX: Record<string, string> = {
  white: "#efeadf", "off white": "#e8dfcc", "off-white": "#e8dfcc", cream: "#eadfc2", ecru: "#ddd0b0", natural: "#d8cbaa", beige: "#cdb994",
  black: "#26252a", navy: "#22305e", "navy blue": "#22305e", "royal blue": "#2f4fb8", blue: "#3c5fb0", "sky blue": "#86b4dc", indigo: "#2b3a78",
  red: "#b23a31", maroon: "#6e2230", wine: "#5d1f33", rust: "#a4502c", orange: "#d97a2b", peach: "#e8b294", pink: "#dd8aa6", "baby pink": "#efbdcc",
  yellow: "#e2be3c", mustard: "#c99a24", green: "#4d7d44", olive: "#6c6d36", "olive green": "#6c6d36", "bottle green": "#1f4b37", teal: "#2a7473",
  grey: "#8d8d8f", gray: "#8d8d8f", "light grey": "#b9b9b8", "dark grey": "#545457", khaki: "#b4a273", brown: "#6b4a32", lavender: "#ab9cc9", purple: "#6a3f8b",
};
const CAT_DEFAULT: Record<Category, string> = {
  "Cotton Fabric": "#e3dccb",
  "Viscose & Rayon": "#c4a7c9",
  "Polyester & Synthetics": "#9fb7d6",
  Denim: "#2b3a78",
  "Knit Fabric": "#d9c7a2",
  "Linen & Blends": "#cbbd98",
  Yarn: "#e6d5b0",
  "Trims & Accessories": "#9a958c",
};
function weaveOf(category: Category, specs: Specs, product: string) {
  const p = product.toLowerCase();
  if (category === "Yarn" || p.includes("thread")) return "yarn";
  if (category === "Knit Fabric") return "knit";
  if (category === "Trims & Accessories") return "trim";
  if (category === "Denim" || specs.weave === "twill" || p.includes("twill") || p.includes("canvas")) return "twill";
  if (p.includes("satin") || specs.weave === "satin") return "satin";
  return "plain";
}
export function Swatch({ category, specs, product, size }: { category: Category; specs: Specs; product: string; size?: "sm" | "lg" }) {
  const color = (specs.color && COLOR_HEX[specs.color.toLowerCase()]) || CAT_DEFAULT[category];
  return <span className={`swatch ${weaveOf(category, specs, product)} ${size ?? ""}`} style={{ ["--c" as string]: color }} title={`${product}${specs.color ? ` · ${specs.color}` : ""}`} />;
}

// ───────── Little pieces ─────────
export function Spinner() {
  return <span className="bobbin" aria-label="Loading" />;
}

export function Confidence({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const cls = pct >= 80 ? "b-mehendi" : pct >= 60 ? "b-turmeric" : "b-madder";
  return <span className={`badge plain ${cls} num`} title="How sure the agent is about this reading">{pct}%</span>;
}

export function Modal({ open, onClose, children }: { open: boolean; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        {children}
      </div>
    </div>
  );
}

export function copy(text: string) {
  return navigator.clipboard?.writeText(text).then(() => true, () => false) ?? Promise.resolve(false);
}
