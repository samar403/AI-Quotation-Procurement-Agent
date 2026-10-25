import type { DB, Order, Quote, QuoteLine, RequirementItem, Settings, Supplier } from "./types";
import { mutate, read, reset, uid } from "./db";
import { compareAll, compareItem } from "./agent/compare";
import { buildQuote } from "./agent/quote";
import { runAgent } from "./agent/pipeline";
import { emptyDB } from "./seed";
import { SAMPLES } from "./samples";
import { inr } from "./format";
import { LEXICON, lexiconFor } from "./lexicon";

export class NotFound extends Error {}
export class BadRequest extends Error {}

function findOrder(db: DB, id: string) {
  const o = db.orders.find((x) => x.id === id || x.ref === id);
  if (!o) throw new NotFound("Order not found");
  return o;
}

function findQuote(db: DB, id: string) {
  const q = db.quotes.find((x) => x.id === id || x.number === id);
  if (!q) throw new NotFound("Quote not found");
  return q;
}

function lineOverrides(q?: Quote) {
  const out: Record<string, Partial<Pick<QuoteLine, "marginPct" | "unitPrice">>> = {};
  for (const l of q?.lines ?? []) out[l.itemId] = { marginPct: l.marginPct };
  return out;
}

// Re-price the order's quote after any change, keeping a revision trail and the margins the
// user set by hand. A quote that was already sent goes back through approval only if a
// guardrail is now tripped.
function requote(db: DB, order: Order, actor: string, keepMargins = true) {
  const prev = order.quoteId ? db.quotes.find((q) => q.id === order.quoteId) : undefined;
  if (!order.items.length || !order.comparisons.some((c) => c.offers.length)) return prev ?? null;
  let number = prev?.number;
  if (!number) {
    db.counters.quote += 1;
    number = `TQ-${new Date().getFullYear()}-${String(db.counters.quote).padStart(4, "0")}`;
  }
  const next = buildQuote(order, db.settings, { id: prev?.id ?? uid("qt"), number, previous: prev, overrides: keepMargins ? lineOverrides(prev) : {} });
  if (prev) {
    const i = db.quotes.findIndex((q) => q.id === prev.id);
    db.quotes[i] = next;
  } else {
    db.quotes.unshift(next);
  }
  order.quoteId = next.id;
  order.status = next.status === "approved" ? "approved" : "pending_approval";
  order.timeline.push({ at: next.updatedAt, kind: "quote", text: `Quote ${next.number} ${prev ? `revised (r${next.revision})` : "drafted"} · ${inr(next.total)}`, actor });
  return next;
}

export async function getOrder(id: string) {
  const db = await read();
  const order = findOrder(db, id);
  const quote = order.quoteId ? db.quotes.find((q) => q.id === order.quoteId) ?? null : null;
  return { order, quote, suppliers: db.suppliers.map(({ catalog, ...s }) => ({ ...s, skuCount: catalog.length })) };
}

export async function updateOrderItems(id: string, patch: { items?: RequirementItem[]; deliveryBy?: string | null; customer?: Order["customer"]; deliveryLocation?: string | null }, actor = "You") {
  return mutate((db) => {
    const order = findOrder(db, id);
    if (patch.customer) order.customer = { ...order.customer, ...patch.customer };
    if (patch.deliveryBy !== undefined) order.deliveryBy = patch.deliveryBy;
    if (patch.deliveryLocation !== undefined) order.deliveryLocation = patch.deliveryLocation;
    if (patch.items) {
      for (const it of patch.items) {
        if (!it.product?.trim()) throw new BadRequest("Every item needs a product name");
        if (!(it.quantity > 0)) throw new BadRequest(`Quantity for ${it.product} must be greater than zero`);
        it.id ||= uid("itm");
        it.confidence = Math.max(it.confidence ?? 1, 0.95); // a human checked it
      }
      order.items = patch.items;
    }
    // Keep supplier picks the user made where the supplier still qualifies.
    const before = new Map(order.comparisons.map((c) => [c.itemId, c.selectedSupplierId]));
    order.comparisons = compareAll(order.items, db.suppliers, db.settings, order.deliveryBy);
    for (const c of order.comparisons) {
      const pick = before.get(c.itemId);
      if (pick && c.offers.some((o) => o.supplierId === pick)) c.selectedSupplierId = pick;
    }
    order.updatedAt = new Date().toISOString();
    order.timeline.push({ at: order.updatedAt, kind: "edit", text: "Requirement edited and re-compared", actor });
    const quote = requote(db, order, actor);
    return { order, quote };
  });
}

export async function selectSupplier(orderId: string, itemId: string, supplierId: string, actor = "You") {
  return mutate((db) => {
    const order = findOrder(db, orderId);
    const cmp = order.comparisons.find((c) => c.itemId === itemId);
    const offer = cmp?.offers.find((o) => o.supplierId === supplierId);
    if (!cmp || !offer) throw new BadRequest("That supplier has no offer for this item");
    cmp.selectedSupplierId = supplierId;
    const item = order.items.find((i) => i.id === itemId)!;
    order.updatedAt = new Date().toISOString();
    order.timeline.push({ at: order.updatedAt, kind: "edit", text: `Switched ${item.product} to ${offer.supplierName} @ ${inr(offer.landedCost)}`, actor });
    const quote = requote(db, order, actor);
    return { order, quote };
  });
}

export async function updateQuoteLine(quoteId: string, itemId: string, change: { marginPct?: number; unitPrice?: number }, actor = "You") {
  return mutate((db) => {
    const quote = findQuote(db, quoteId);
    const order = findOrder(db, quote.orderId);
    const overrides = lineOverrides(quote);
    if (change.unitPrice != null) {
      if (!(change.unitPrice > 0)) throw new BadRequest("Price must be positive");
      overrides[itemId] = { unitPrice: change.unitPrice };
    } else if (change.marginPct != null) {
      if (change.marginPct < -50 || change.marginPct > 300) throw new BadRequest("Margin looks wrong");
      overrides[itemId] = { marginPct: change.marginPct };
    }
    const next = buildQuote(order, db.settings, { id: quote.id, number: quote.number, previous: quote, overrides });
    db.quotes[db.quotes.indexOf(quote)] = next;
    order.status = next.status === "approved" ? "approved" : "pending_approval";
    order.timeline.push({ at: next.updatedAt, kind: "quote", text: `Price adjusted on ${quote.lines.find((l) => l.itemId === itemId)?.description.split(" — ")[0]} → total ${inr(next.total)}`, actor });
    return { order, quote: next };
  });
}

type QuoteAction = "approve" | "reject" | "send" | "won" | "lost" | "reopen";

const ALLOWED: Record<QuoteAction, Quote["status"][]> = {
  approve: ["pending_approval", "rejected", "draft"],
  reject: ["pending_approval", "draft", "approved"],
  send: ["approved", "sent"],
  won: ["sent", "approved"],
  lost: ["sent", "approved", "pending_approval"],
  reopen: ["won", "lost", "rejected", "sent"],
};

export async function quoteAction(quoteId: string, action: QuoteAction, by = "You", note?: string, channel?: string) {
  return mutate((db) => {
    const quote = findQuote(db, quoteId);
    const order = findOrder(db, quote.orderId);
    if (!ALLOWED[action]) throw new BadRequest("Unknown action");
    if (!ALLOWED[action].includes(quote.status)) throw new BadRequest(`Can't ${action} a quote that is ${quote.status.replace("_", " ")}`);
    const at = new Date().toISOString();
    const map = {
      approve: ["approved", "approved", "approval"],
      reject: ["rejected", "rejected", "approval"],
      send: ["sent", "sent", "send"],
      won: ["won", "won", "outcome"],
      lost: ["lost", "lost", "outcome"],
      reopen: ["pending_approval", "revised", "edit"],
    } as const;
    const [status, entry, kind] = map[action];
    quote.status = status;
    quote.updatedAt = at;
    quote.approvals.push({ at, by, action: entry, note });
    order.status = status === "pending_approval" ? "pending_approval" : status;
    order.updatedAt = at;
    const text = {
      approve: `Approved by ${by}${note ? ` — “${note}”` : ""}`,
      reject: `Rejected by ${by}${note ? ` — “${note}”` : ""}`,
      send: `Quote sent to buyer${channel ? ` via ${channel}` : ""}`,
      won: `Order won 🎉 · ${inr(quote.total)}`,
      lost: `Marked lost${note ? ` — ${note}` : ""}`,
      reopen: "Quote reopened for revision",
    }[action];
    order.timeline.push({ at, kind, text, actor: by });
    return { order, quote };
  });
}

export async function deleteOrder(id: string) {
  return mutate((db) => {
    const order = findOrder(db, id);
    db.orders = db.orders.filter((o) => o.id !== order.id);
    db.quotes = db.quotes.filter((q) => q.orderId !== order.id);
    return { ok: true };
  });
}

// ---------- Suppliers ----------

export async function upsertSupplier(input: Partial<Supplier> & { name: string }) {
  return mutate((db) => {
    if (!input.name?.trim()) throw new BadRequest("Supplier name is required");
    const existing = input.id ? db.suppliers.find((s) => s.id === input.id) : undefined;
    if (existing) {
      Object.assign(existing, { ...input, catalog: input.catalog ?? existing.catalog });
      return existing;
    }
    const s: Supplier = {
      id: uid("sup"),
      name: input.name.trim(),
      city: input.city ?? "",
      state: input.state ?? "",
      gstin: input.gstin ?? "",
      contactName: input.contactName ?? "",
      phone: input.phone ?? "",
      email: input.email ?? "",
      categories: input.categories ?? [],
      onTimeRate: input.onTimeRate ?? 0.85,
      qualityScore: input.qualityScore ?? 0.85,
      paymentTerms: input.paymentTerms ?? "30 days credit",
      freightPerUnit: input.freightPerUnit ?? { m: 1.5, kg: 6 },
      catalog: input.catalog ?? [],
      notes: input.notes,
      createdAt: new Date().toISOString(),
    };
    db.suppliers.push(s);
    return s;
  });
}

export async function deleteSupplier(id: string) {
  return mutate((db) => {
    db.suppliers = db.suppliers.filter((s) => s.id !== id);
    return { ok: true };
  });
}

// CSV columns: supplier,product,category,price,unit,moq,stock,lead_time_days,gsm,width,count,composition,color,finish,sku,hsn
export async function importCatalogCsv(csv: string) {
  const rows = csv.trim().split(/\r?\n/).map((l) => l.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
  const [header, ...data] = rows;
  const idx = (k: string) => header.findIndex((h) => h.toLowerCase().replace(/\s+/g, "_") === k);
  const req = ["supplier", "product", "price"];
  for (const k of req) if (idx(k) < 0) throw new BadRequest(`CSV is missing the "${k}" column`);
  return mutate((db) => {
    let added = 0;
    let updated = 0;
    const errors: string[] = [];
    data.forEach((r, n) => {
      const get = (k: string) => (idx(k) >= 0 ? r[idx(k)] : "");
      const price = Number(get("price"));
      if (!get("supplier") || !get("product") || !(price > 0)) {
        errors.push(`Row ${n + 2}: needs supplier, product and a positive price`);
        return;
      }
      let sup = db.suppliers.find((s) => s.name.toLowerCase() === get("supplier").toLowerCase());
      const lex = lexiconFor(get("product")) ?? LEXICON[0];
      if (!sup) {
        sup = { id: uid("sup"), name: get("supplier"), city: "", state: "", gstin: "", contactName: "", phone: "", email: "", categories: [], onTimeRate: 0.85, qualityScore: 0.85, paymentTerms: "30 days credit", freightPerUnit: { m: 1.5, kg: 6 }, catalog: [], createdAt: new Date().toISOString() };
        db.suppliers.push(sup);
      }
      const category = (get("category") || lex.category) as Supplier["categories"][number];
      if (!sup.categories.includes(category)) sup.categories.push(category);
      const specs = {
        ...(get("gsm") ? { gsm: Number(get("gsm")) } : {}),
        ...(get("width") ? { widthInch: Number(get("width")) } : {}),
        ...(get("count") ? { count: get("count") } : {}),
        ...(get("composition") ? { composition: get("composition") } : {}),
        ...(get("color") ? { color: get("color") } : {}),
        ...(get("finish") ? { finish: get("finish") } : {}),
      };
      const sku = get("sku") || `${sup.name.slice(0, 3).toUpperCase()}-${get("product").replace(/[^a-z]/gi, "").slice(0, 4).toUpperCase()}-${sup.catalog.length + 1}`;
      const existing = sup.catalog.find((c) => c.sku === sku);
      const entry = {
        id: existing?.id ?? uid("cat"),
        sku,
        product: lexiconFor(get("product"))?.product ?? get("product"),
        category,
        hsn: get("hsn") || lex.hsn,
        specs,
        unit: (get("unit") || lex.unit) as Supplier["catalog"][number]["unit"],
        price,
        moq: Number(get("moq")) || 0,
        stock: Number(get("stock")) || 0,
        leadTimeDays: Number(get("lead_time_days")) || 7,
        updatedAt: new Date().toISOString(),
      };
      if (existing) {
        Object.assign(existing, entry);
        updated++;
      } else {
        sup.catalog.push(entry);
        added++;
      }
    });
    return { added, updated, errors };
  });
}

// ---------- Settings & stats ----------

export async function updateSettings(patch: Partial<Settings>) {
  return mutate((db) => {
    db.settings = {
      ...db.settings,
      ...patch,
      business: { ...db.settings.business, ...patch.business },
      pricing: { ...db.settings.pricing, ...patch.pricing, categoryMargins: { ...db.settings.pricing.categoryMargins, ...patch.pricing?.categoryMargins } },
      approval: { ...db.settings.approval, ...patch.approval },
      weights: { ...db.settings.weights, ...patch.weights },
      plan: { ...db.settings.plan, ...patch.plan },
    };
    return db.settings;
  });
}

export function computeStats(db: DB, now = new Date()) {
  const quotes = db.quotes;
  const decided = quotes.filter((q) => q.status === "won" || q.status === "lost");
  const won = quotes.filter((q) => q.status === "won");
  const pending = quotes.filter((q) => q.status === "pending_approval");
  const turnaround = db.orders.filter((o) => o.quoteId).map((o) => o.extraction.durationMs);
  const avgTurnaroundSec = turnaround.length ? turnaround.reduce((s, v) => s + v, 0) / turnaround.length / 1000 : 0;
  const savings = db.orders.reduce((s, o) => s + o.comparisons.reduce((a, c) => a + Math.max(0, c.savingsVsAverage ?? 0), 0), 0);
  const pipeline = quotes.filter((q) => ["approved", "sent", "pending_approval"].includes(q.status)).reduce((s, q) => s + q.total, 0);
  const days = [...Array(14)].map((_, i) => {
    const d = new Date(now.getTime() - (13 - i) * 86400000).toISOString().slice(0, 10);
    const qs = quotes.filter((q) => q.createdAt.slice(0, 10) === d);
    return { day: d, quotes: qs.length, value: Math.round(qs.reduce((s, q) => s + q.total, 0)) };
  });
  const byStatus = Object.fromEntries(["extracted", "pending_approval", "approved", "sent", "won", "lost", "rejected"].map((s) => [s, db.orders.filter((o) => o.status === s).length]));
  return {
    orders: db.orders.length,
    quotes: quotes.length,
    pendingApproval: pending.length,
    winRate: decided.length ? won.length / decided.length : null,
    wonValue: won.reduce((s, q) => s + q.total, 0),
    avgMarginPct: quotes.length ? quotes.reduce((s, q) => s + q.marginPct, 0) / quotes.length : 0,
    avgTurnaroundSec,
    savings,
    pipeline,
    days,
    byStatus,
  };
}

export async function stats() {
  return computeStats(await read());
}

// ---------- Demo workspace ----------

export async function resetDemo() {
  await reset(emptyDB());
  const noop = () => undefined;
  const now = Date.now();
  // Process the samples as if they arrived over the last few days, then move them along the funnel.
  const plan: Array<{ id: string; hoursAgo: number; outcome: "won" | "sent" | "approved" | "pending" }> = [
    { id: "vastra-po", hoursAgo: 70, outcome: "won" },
    { id: "anaya-email", hoursAgo: 26, outcome: "sent" },
    { id: "imran-text", hoursAgo: 3, outcome: "pending" },
  ];
  for (const p of plan) {
    const sample = SAMPLES.find((s) => s.id === p.id)!;
    const at = new Date(now - p.hoursAgo * 3600000);
    const { quote } = await runAgent({ text: sample.content }, noop, at, { forceHeuristic: true });
    if (!quote) continue;
    if (quote.status === "pending_approval" && p.outcome !== "pending") await quoteAction(quote.id, "approve", "Mahesh Agarwal", "Rates checked with mill");
    if (p.outcome === "sent" || p.outcome === "won") await quoteAction(quote.id, "send", "Priya Agarwal", undefined, "WhatsApp");
    if (p.outcome === "won") await quoteAction(quote.id, "won", "Priya Agarwal");
  }
  // Backdate the funnel actions to the order's arrival so the timeline reads naturally.
  await mutate((db) => {
    db.seeded = true;
    for (const o of db.orders) {
      const base = new Date(o.createdAt).getTime();
      o.timeline.forEach((t, i) => (t.at = new Date(base + i * 7 * 60000).toISOString()));
      const q = db.quotes.find((x) => x.id === o.quoteId);
      if (q) {
        q.createdAt = o.createdAt;
        q.approvals.forEach((a, i) => (a.at = new Date(base + (i + 3) * 7 * 60000).toISOString()));
        q.updatedAt = q.approvals.at(-1)?.at ?? q.updatedAt;
      }
    }
  });
  return read();
}

// Single-flight: concurrent first requests share one seeding run.
let seeding: Promise<void> | null = null;
export function ensureSeeded() {
  seeding ??= (async () => {
    if (!(await read()).seeded) await resetDemo();
  })().catch((err) => {
    seeding = null;
    throw err;
  });
  return seeding;
}

export { compareItem };
