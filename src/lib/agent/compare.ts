import type { CatalogEntry, ItemComparison, Offer, RequirementItem, Settings, Specs, Supplier } from "../types";

// Supplier comparison. For each requirement we find every catalog SKU that can fulfil it,
// cost it all the way to the door (price + freight), and score it on price, lead time vs. the
// buyer's deadline, supplier reliability, and MOQ/stock fit. Weights come from Settings.

const tokens = (s: string) => new Set(s.toLowerCase().split(/[^a-z0-9]+/).filter((t) => t.length > 1));

function overlap(a: string, b: string) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const t of A) if (B.has(t)) hit++;
  return hit / Math.max(A.size, B.size);
}

const normCount = (c?: string) => (c ?? "").toLowerCase().replace(/[\s']+/g, "").replace(/ne$/, "").replace(/s$/, "");

// 0..1 — how well a catalog SKU satisfies the requirement. Unstated buyer specs are neutral.
export function specMatch(req: RequirementItem, cat: CatalogEntry): number {
  if (req.unit !== cat.unit && !(req.unit === "roll" && cat.unit === "m")) return 0;
  const sameProduct = req.product.toLowerCase() === cat.product.toLowerCase();
  const name = sameProduct ? 1 : overlap(req.product, cat.product);
  if (!sameProduct && req.category !== cat.category) return 0;
  if (name === 0 && !sameProduct) return 0;

  const checks: number[] = [];
  const r: Specs = req.specs;
  const c: Specs = cat.specs;
  if (r.gsm && c.gsm) {
    const d = Math.abs(r.gsm - c.gsm) / r.gsm;
    checks.push(d <= 0.05 ? 1 : d <= 0.12 ? 0.7 : d <= 0.2 ? 0.35 : 0);
  }
  if (r.widthInch && c.widthInch) {
    const d = Math.abs(r.widthInch - c.widthInch);
    checks.push(d === 0 ? 1 : d <= 2 ? 0.75 : c.widthInch > r.widthInch ? 0.5 : 0);
  }
  if (r.count && c.count) checks.push(normCount(r.count) === normCount(c.count) ? 1 : overlap(r.count, c.count) > 0 ? 0.5 : 0.1);
  if (r.construction && c.construction) checks.push(normCount(r.construction) === normCount(c.construction) ? 1 : 0.4);
  if (r.composition && c.composition) checks.push(overlap(r.composition, c.composition) > 0.3 ? 1 : 0.4);

  const spec = checks.length ? checks.reduce((s, v) => s + v, 0) / checks.length : 0.8;
  return Math.round((0.45 * (sameProduct ? 1 : name) + 0.55 * spec) * 100) / 100;
}

function daysUntil(iso?: string | null, now = new Date()) {
  if (!iso) return null;
  return Math.ceil((new Date(iso).getTime() - now.getTime()) / 86400000);
}

const MIN_MATCH = 0.5;

export function compareItem(item: RequirementItem, suppliers: Supplier[], settings: Settings, deliveryBy?: string | null, now = new Date()): ItemComparison {
  const days = daysUntil(deliveryBy, now);
  const candidates: Array<{ s: Supplier; c: CatalogEntry; match: number }> = [];
  for (const s of suppliers) {
    let best: { c: CatalogEntry; match: number } | null = null;
    for (const c of s.catalog) {
      const match = specMatch(item, c);
      if (match >= MIN_MATCH && (!best || match > best.match || (match === best.match && c.price < best.c.price))) best = { c, match };
    }
    if (best) candidates.push({ s, ...best });
  }

  if (!candidates.length) {
    return {
      itemId: item.id,
      offers: [],
      recommendedSupplierId: null,
      selectedSupplierId: null,
      marketAverage: null,
      savingsVsAverage: null,
      reason: `No supplier in your network lists ${item.product}${item.specs.gsm ? ` ${item.specs.gsm} GSM` : ""}. Send an RFQ to get prices.`,
      needsRfq: true,
    };
  }

  const priced = candidates.map(({ s, c, match }) => {
    const freight = s.freightPerUnit[c.unit] ?? 0;
    return { s, c, match, freight, landed: c.price + freight };
  });
  const minLanded = Math.min(...priced.map((p) => p.landed));
  const minLead = Math.min(...priced.map((p) => p.c.leadTimeDays));
  const w = settings.weights;
  const wSum = w.price + w.lead + w.reliability + w.moq || 1;

  const offers: Offer[] = priced.map(({ s, c, match, freight, landed }) => {
    const flags: string[] = [];
    const price = minLanded / landed;
    let lead = minLead / c.leadTimeDays;
    if (days != null) {
      if (c.leadTimeDays > days) {
        lead = 0.1;
        flags.push(`Lead time ${c.leadTimeDays}d misses deadline (${Math.max(days, 0)}d left)`);
      } else if (c.leadTimeDays > days - 2) {
        lead *= 0.8;
        flags.push("Tight on deadline");
      }
    }
    const reliability = 0.6 * s.onTimeRate + 0.4 * s.qualityScore;
    let moq = 1;
    if (item.quantity < c.moq) {
      moq = 0.35;
      flags.push(`Below MOQ (${c.moq.toLocaleString("en-IN")} ${c.unit})`);
    }
    if (c.stock < item.quantity) {
      moq *= 0.7;
      flags.push(`Only ${c.stock.toLocaleString("en-IN")} ${c.unit} in stock`);
    }
    if (match < 0.75) flags.push("Close match — confirm specs");
    const raw = (w.price * price + w.lead * lead + w.reliability * reliability + w.moq * moq) / wSum;
    const score = Math.round(raw * (0.7 + 0.3 * match) * 1000) / 10;
    return {
      supplierId: s.id,
      supplierName: s.name,
      city: s.city,
      catalogId: c.id,
      sku: c.sku,
      product: c.product,
      unitPrice: c.price,
      freightPerUnit: freight,
      landedCost: Math.round(landed * 100) / 100,
      total: Math.round(landed * item.quantity),
      moq: c.moq,
      stock: c.stock,
      leadTimeDays: c.leadTimeDays,
      score,
      breakdown: {
        price: Math.round(price * 100) / 100,
        lead: Math.round(lead * 100) / 100,
        reliability: Math.round(reliability * 100) / 100,
        moq: Math.round(moq * 100) / 100,
        match,
      },
      flags,
    };
  });
  offers.sort((a, b) => b.score - a.score);

  const best = offers[0];
  const avg = offers.reduce((s, o) => s + o.landedCost, 0) / offers.length;
  const cheapest = offers.reduce((m, o) => (o.landedCost < m.landedCost ? o : m), offers[0]);
  const savings = Math.round((avg - best.landedCost) * item.quantity);

  const parts: string[] = [];
  if (best.supplierId === cheapest.supplierId) parts.push(`${best.supplierName} is the lowest landed cost at ₹${best.landedCost}/${item.unit}`);
  else parts.push(`${best.supplierName} wins on overall value — ₹${(best.landedCost - cheapest.landedCost).toFixed(2)}/${item.unit} above ${cheapest.supplierName}, but ${cheapest.flags[0]?.toLowerCase() ?? "scores lower on reliability and lead time"}`);
  parts.push(`ships in ${best.leadTimeDays} days${days != null ? ` (deadline in ${Math.max(days, 0)})` : ""}`);
  parts.push(`${Math.round(best.breakdown.reliability * 100)}% reliability`);
  if (offers.length > 1 && savings > 0) parts.push(`saves ₹${savings.toLocaleString("en-IN")} vs. market average`);

  return {
    itemId: item.id,
    offers,
    recommendedSupplierId: best.supplierId,
    selectedSupplierId: best.supplierId,
    marketAverage: Math.round(avg * 100) / 100,
    savingsVsAverage: offers.length > 1 ? savings : null,
    reason: `${parts.join("; ")}.`,
    needsRfq: offers.length < 2,
  };
}

export function compareAll(items: RequirementItem[], suppliers: Supplier[], settings: Settings, deliveryBy?: string | null, now = new Date()) {
  return items.map((i) => compareItem(i, suppliers, settings, deliveryBy, now));
}
