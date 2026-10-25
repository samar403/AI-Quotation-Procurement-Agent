"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Icon } from "./icons";
import { Providers, useApi, useApp } from "./ui";
import { planFor } from "@/lib/plans";
import type { Settings } from "@/lib/types";

const NAV = [
  { href: "/desk", label: "Loom board", icon: Icon.Loom },
  { href: "/desk/intake", label: "New order", icon: Icon.Upload },
  { href: "/desk/orders", label: "Orders", icon: Icon.Inbox },
  { href: "/desk/quotes", label: "Quotations", icon: Icon.Receipt, count: "pending" as const },
  { href: "/desk/suppliers", label: "Suppliers", icon: Icon.Mill },
  { href: "/desk/settings", label: "Settings & plan", icon: Icon.Gear },
];

function ThemeToggle() {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    const t = document.documentElement.dataset.theme as "light" | "dark" | undefined;
    setTheme(t ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"));
  }, []);
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("taana-theme", next);
    } catch {}
    setTheme(next);
  };
  return (
    <button className="btn btn-ghost btn-sm" onClick={flip} aria-label="Toggle dark mode" title="Day loom / night shift">
      {theme === "dark" ? <Icon.Sun /> : <Icon.Moon />}
    </button>
  );
}

function Palette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const { data: orders } = useApi<Array<{ id: string; ref: string; customer: { name: string; company?: string }; quote: { number: string } | null }>>(open ? "/api/orders" : null);
  const items = useMemo(() => {
    const base = [
      ...NAV.map((n) => ({ label: n.label, hint: "Go to", href: n.href })),
      { label: "Try the sample WhatsApp order", hint: "Demo", href: "/desk/intake?sample=mehta-whatsapp" },
      ...(orders ?? []).map((o) => ({ label: `${o.ref} · ${o.customer.company ?? o.customer.name}${o.quote ? ` · ${o.quote.number}` : ""}`, hint: "Order", href: `/desk/orders/${o.id}` })),
    ];
    const t = q.toLowerCase().trim();
    return t ? base.filter((i) => i.label.toLowerCase().includes(t)) : base;
  }, [q, orders]);
  useEffect(() => {
    setActive(0);
  }, [q]);
  if (!open) return null;
  const go = (href: string) => {
    onClose();
    setQ("");
    router.push(href);
  };
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="palette" role="dialog" aria-label="Command palette">
        <input
          autoFocus
          placeholder="Jump to an order, quote number, buyer or page…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose();
            if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, items.length - 1));
            if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0));
            if (e.key === "Enter" && items[active]) go(items[active].href);
          }}
        />
        <ul>
          {items.slice(0, 40).map((i, n) => (
            <li key={i.href + n}>
              <button data-active={n === active} onMouseEnter={() => setActive(n)} onClick={() => go(i.href)}>
                <span className="eyebrow" style={{ width: 56 }}>
                  {i.hint}
                </span>
                {i.label}
              </button>
            </li>
          ))}
          {!items.length && <li className="empty">No match</li>}
        </ul>
      </div>
    </div>
  );
}

function Rail({ open, onNavigate }: { open: boolean; onNavigate: () => void }) {
  const path = usePathname();
  const { data: settings } = useApi<Settings>("/api/settings");
  const { data: stats } = useApi<{ pendingApproval: number }>("/api/stats");
  const plan = settings ? planFor(settings.plan.tier) : null;
  const used = settings?.plan.docsUsed ?? 0;
  return (
    <aside className={`rail${open ? " open" : ""}`}>
      <Link href="/" className="brand" onClick={onNavigate}>
        <img src="/favicon.svg" width={32} height={32} alt="" />
        <div>
          <div className="brand-name">taana</div>
          <div className="brand-sub">procurement desk</div>
        </div>
      </Link>
      {NAV.map((n) => {
        const active = n.href === "/desk" ? path === "/desk" : path?.startsWith(n.href);
        const I = n.icon;
        return (
          <Link key={n.href} href={n.href} className="nav-link" aria-current={active ? "page" : undefined} onClick={onNavigate}>
            <I />
            {n.label}
            {n.count && stats?.pendingApproval ? <span className="count">{stats.pendingApproval}</span> : null}
          </Link>
        );
      })}
      <div className="rail-foot">
        {settings && plan && (
          <Link href="/desk/settings#plan" className="plan-meter" onClick={onNavigate}>
            <div className="spread">
              <b>{plan.name} plan</b>
              <span className="faint num">₹{plan.priceMonthly.toLocaleString("en-IN")}/mo</span>
            </div>
            <div className="meter">
              <i style={{ width: `${Math.min(100, (used / plan.docsLimit) * 100)}%` }} />
            </div>
            <span className="faint">
              {used} of {plan.docsLimit} orders read this month
            </span>
          </Link>
        )}
        <div className="faint" style={{ fontSize: 12, padding: "0 4px" }}>
          {settings?.business.name}
        </div>
      </div>
    </aside>
  );
}

function Topbar({ onMenu, onSearch }: { onMenu: () => void; onSearch: () => void }) {
  const { actor, setActor, approvers, ai } = useApp();
  return (
    <header className="topbar no-print">
      <button className="btn btn-ghost btn-sm only-mobile" onClick={onMenu} aria-label="Open menu">
        <Icon.Menu />
      </button>
      <button className="btn btn-sm search-btn" onClick={onSearch} style={{ minWidth: 0, flex: "0 1 340px", justifyContent: "flex-start", color: "var(--ink-3)" }}>
        <Icon.Search size={16} /> <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>Search orders, quotes, buyers</span>
        <span className="kbd" style={{ marginLeft: "auto" }}>⌘K</span>
      </button>
      <div style={{ flex: 1 }} />
      {ai && (
        <span className={`badge ${ai.ai ? "b-mehendi" : "b-turmeric"}`} title={ai.ai ? `Extraction by ${ai.model}` : "Set ANTHROPIC_API_KEY to enable AI reading of photos, scans and messy chats"}>
          {ai.ai ? "Claude reading" : "Offline parser"}
        </span>
      )}
      <label className="row faint" style={{ fontSize: 13 }}>
        <span className="hide-sm">Acting as</span>
        <select className="select" style={{ height: 32, width: "auto" }} value={actor} onChange={(e) => setActor(e.target.value)}>
          {[...new Set([actor, ...approvers])].map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </label>
      <ThemeToggle />
      <Link href="/desk/intake" className="btn btn-primary btn-sm">
        <Icon.Plus size={16} /> <span className="new-label">New order</span>
      </Link>
    </header>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  return (
    <Providers>
      <div className="shell">
        <Rail open={menu} onNavigate={() => setMenu(false)} />
        <div className="main">
          <Topbar onMenu={() => setMenu((m) => !m)} onSearch={() => setPalette(true)} />
          <main className="content">{children}</main>
        </div>
      </div>
      <Palette open={palette} onClose={() => setPalette(false)} />
    </Providers>
  );
}
