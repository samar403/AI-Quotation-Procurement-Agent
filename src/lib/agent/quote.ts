import type { Order, Quote, QuoteLine, Settings } from "../types";
import { HSN_BY_CATEGORY, lexiconFor } from "../lexicon";
import { UNIT_LABEL, fmtDate, inr, qty, specLine } from "../format";

// Quote pricing: landed cost of the chosen supplier + the category margin, rounded to the
// business's price step, then GST. Guardrails decide whether a human must approve it.

const round2 = (n: number) => Math.round(n * 100) / 100;

function roundUp(n: number, step: number) {
  if (!step) return round2(n);
  return round2(Math.ceil(n / step - 1e-9) * step);
}

export function priceLine(cost: number, marginPct: number, step: number) {
  return roundUp(cost * (1 + marginPct / 100), cost < 5 ? 0.01 : step);
}

export function buildLines(order: Order, settings: Settings, overrides: Record<string, Partial<Pick<QuoteLine, "marginPct" | "unitPrice">>> = {}): QuoteLine[] {
  return order.items.map((item) => {
    const cmp = order.comparisons.find((c) => c.itemId === item.id);
    const offer = cmp?.offers.find((o) => o.supplierId === cmp.selectedSupplierId) ?? cmp?.offers[0];
    const cost = offer?.landedCost ?? 0;
    const o = overrides[item.id] ?? {};
    const marginPct = o.marginPct ?? settings.pricing.categoryMargins[item.category] ?? settings.pricing.defaultMarginPct;
    const unitPrice = o.unitPrice ?? (cost ? priceLine(cost, marginPct, settings.pricing.roundTo) : 0);
    const effectiveMargin = cost ? round2(((unitPrice - cost) / cost) * 100) : 0;
    let note: string | undefined;
    if (item.targetPrice && cost) {
      const targetMargin = ((item.targetPrice - cost) / cost) * 100;
      if (item.targetPrice >= unitPrice) note = `Buyer target ${inr(item.targetPrice)} is above our price.`;
      else if (targetMargin >= settings.pricing.minMarginPct) note = `Buyer target ${inr(item.targetPrice)} workable at ${targetMargin.toFixed(1)}% margin.`;
      else note = `Buyer target ${inr(item.targetPrice)} is below cost + minimum margin.`;
    }
    const desc = [item.product, specLine(item.specs)].filter(Boolean).join(" — ");
    return {
      itemId: item.id,
      description: desc,
      hsn: lexiconFor(item.product)?.hsn ?? HSN_BY_CATEGORY[item.category],
      quantity: item.quantity,
      unit: item.unit,
      supplierId: offer?.supplierId ?? null,
      supplierName: offer?.supplierName ?? null,
      costPrice: cost,
      marginPct: effectiveMargin,
      unitPrice,
      amount: round2(unitPrice * item.quantity),
      targetPrice: item.targetPrice ?? null,
      note,
    };
  });
}

export function totals(lines: QuoteLine[], taxRate: number) {
  const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  const cost = round2(lines.reduce((s, l) => s + l.costPrice * l.quantity, 0));
  const tax = round2((subtotal * taxRate) / 100);
  const grossProfit = round2(subtotal - cost);
  return { subtotal, cost, tax, total: round2(subtotal + tax), grossProfit, marginPct: cost ? round2((grossProfit / cost) * 100) : 0 };
}

export function approvalCheck(order: Order, lines: QuoteLine[], total: number, settings: Settings) {
  const reasons: string[] = [];
  const a = settings.approval;
  if (total >= a.autoApproveBelow) reasons.push(`Quote value ${inr(Math.round(total))} is above the auto-approve limit of ${inr(a.autoApproveBelow)}.`);
  for (const l of lines) {
    if (!l.costPrice) reasons.push(`No supplier price for "${l.description.split(" — ")[0]}" — needs an RFQ or manual price.`);
    else if (l.marginPct < a.requireApprovalIfMarginBelow) reasons.push(`Margin on "${l.description.split(" — ")[0]}" is ${l.marginPct.toFixed(1)}% (guardrail ${a.requireApprovalIfMarginBelow}%).`);
  }
  for (const i of order.items) if (i.confidence < a.requireApprovalIfConfidenceBelow) reasons.push(`Low reading confidence on "${i.rawText.slice(0, 48)}" (${Math.round(i.confidence * 100)}%).`);
  for (const c of order.comparisons) {
    const o = c.offers.find((x) => x.supplierId === c.selectedSupplierId);
    if (o?.flags.some((f) => f.includes("misses deadline"))) reasons.push(`${o.supplierName} may miss the delivery date.`);
  }
  return reasons;
}

function drafts(order: Order, q: Pick<Quote, "number" | "lines" | "subtotal" | "tax" | "total" | "taxRate" | "validUntil" | "deliveryBy">, settings: Settings) {
  const first = (order.customer.name ?? "").split(" ")[0] || "Sir";
  const lineText = q.lines
    .map((l, i) => `${i + 1}. ${l.description}\n   ${qty(l.quantity)} ${UNIT_LABEL[l.unit]} × ${inr(l.unitPrice)} = *${inr(l.amount)}*`)
    .join("\n");
  const whatsapp = [
    `Namaste ${first} ji 🙏`,
    `Quotation *${q.number}* from ${settings.business.name}:`,
    "",
    lineText,
    "",
    `Subtotal: ${inr(q.subtotal)}`,
    `GST @${q.taxRate}%: ${inr(q.tax)}`,
    `*Total: ${inr(q.total)}*`,
    "",
    q.deliveryBy ? `Delivery by ${fmtDate(q.deliveryBy)}.` : "Delivery: 7–10 days from order confirmation.",
    `Rates valid till ${fmtDate(q.validUntil)}. Reply *OK* to confirm and we'll book the lot today.`,
  ].join("\n");
  const body = [
    `Dear ${order.customer.name ?? "Sir/Madam"},`,
    "",
    `Thank you for your enquiry. Please find our quotation ${q.number} below${order.customer.company ? ` for ${order.customer.company}` : ""}.`,
    "",
    ...q.lines.map((l, i) => `${i + 1}. ${l.description} — ${qty(l.quantity)} ${UNIT_LABEL[l.unit]} @ ${inr(l.unitPrice)} = ${inr(l.amount)}`),
    "",
    `Subtotal: ${inr(q.subtotal)}`,
    `GST @ ${q.taxRate}%: ${inr(q.tax)}`,
    `Grand total: ${inr(q.total)}`,
    "",
    `Rates are valid until ${fmtDate(q.validUntil)}. The PDF quotation is attached.`,
    "",
    "Warm regards,",
    settings.business.signatory,
    settings.business.name,
    settings.business.phone,
  ].join("\n");
  return { whatsapp, email: { subject: `Quotation ${q.number} — ${settings.business.name}`, body } };
}

export function buildQuote(order: Order, settings: Settings, opts: { id: string; number: string; now?: Date; previous?: Quote; overrides?: Record<string, Partial<Pick<QuoteLine, "marginPct" | "unitPrice">>> }): Quote {
  const now = opts.now ?? new Date();
  const lines = buildLines(order, settings, opts.overrides);
  const t = totals(lines, settings.pricing.taxRate);
  const reasons = approvalCheck(order, lines, t.total, settings);
  const validUntil = new Date(now.getTime() + settings.pricing.quoteValidityDays * 86400000).toISOString();
  const base = {
    number: opts.number,
    lines,
    subtotal: t.subtotal,
    tax: t.tax,
    total: t.total,
    taxRate: settings.pricing.taxRate,
    validUntil,
    deliveryBy: order.deliveryBy ?? null,
  };
  const requiresApproval = reasons.length > 0;
  const history = opts.previous?.approvals ?? [];
  return {
    id: opts.id,
    orderId: order.id,
    orderRef: order.ref,
    createdAt: opts.previous?.createdAt ?? now.toISOString(),
    updatedAt: now.toISOString(),
    customer: order.customer,
    cost: t.cost,
    grossProfit: t.grossProfit,
    marginPct: t.marginPct,
    terms: [
      `Prices are ex-godown ${settings.business.address.split(",").slice(-2, -1)[0]?.replace(/\d+/g, "").trim() ?? ""}, per unit, exclusive of GST.`,
      `GST @ ${settings.pricing.taxRate}% extra as applicable.`,
      order.paymentTerms ? `Payment: ${order.paymentTerms}.` : "Payment: 30 days from invoice date.",
      "Shade and width tolerance ±3% as per trade practice.",
      `Quotation valid until ${fmtDate(validUntil)}; subject to stock at the time of confirmation.`,
    ],
    status: requiresApproval ? "pending_approval" : "approved",
    requiresApproval,
    approvalReasons: reasons,
    approvals: [
      ...history,
      opts.previous
        ? { at: now.toISOString(), by: "Taana agent", action: "revised" as const, note: `Revision ${(opts.previous.revision ?? 1) + 1}` }
        : requiresApproval
          ? { at: now.toISOString(), by: "Taana agent", action: "submitted" as const, note: `${reasons.length} guardrail${reasons.length > 1 ? "s" : ""} triggered` }
          : { at: now.toISOString(), by: "Taana agent", action: "auto_approved" as const, note: "Within all guardrails" },
    ],
    drafts: drafts(order, base, settings),
    revision: opts.previous ? (opts.previous.revision ?? 1) + 1 : 1,
    ...base,
  };
}
