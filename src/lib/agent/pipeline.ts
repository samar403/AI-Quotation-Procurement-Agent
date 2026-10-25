import type { AgentEvent, AgentStage, Order, Quote, RequirementItem, Specs, Supplier } from "../types";
import { mutate, read, uid } from "../db";
import { normalize, type RawInput } from "../ingest/normalize";
import { extract } from "./extract";
import { compareAll } from "./compare";
import { buildQuote } from "./quote";
import { planFor } from "../plans";
import type { ExtractionT } from "./schema";
import { duration, inr, qty, UNIT_LABEL } from "../format";

// The agent run: receive → read → extract → match → compare → quote → approve.
// Each stage reports progress through `emit`, which the ingest route streams to the browser.

export type Emit = (e: Omit<AgentEvent, "at">) => void;

export class PlanLimitError extends Error {}
// Raised when a document holds nothing to buy; no order is created and no plan credit is used.
export class NotAnOrderError extends Error {}

export function toItems(x: ExtractionT): RequirementItem[] {
  return x.items.map((i) => {
    const specs: Specs = {};
    if (i.composition) specs.composition = i.composition;
    if (i.gsm) specs.gsm = i.gsm;
    if (i.width_inch) specs.widthInch = i.width_inch;
    if (i.count) specs.count = i.count;
    if (i.construction) specs.construction = i.construction;
    if (i.weave) specs.weave = i.weave;
    if (i.color) specs.color = i.color;
    if (i.finish) specs.finish = i.finish;
    return {
      id: uid("itm"),
      rawText: i.raw_text,
      product: i.product,
      category: i.category,
      specs,
      quantity: i.quantity,
      unit: i.unit,
      targetPrice: i.target_price,
      notes: i.notes ?? undefined,
      confidence: Math.max(0, Math.min(1, i.confidence)),
    };
  });
}

const stageMsg = (stage: AgentStage, message: string, status: AgentEvent["status"] = "done", data?: unknown) => ({ stage, status, message, data });

export async function runAgent(input: RawInput, emit: Emit, now = new Date(), opts: { forceHeuristic?: boolean } = {}): Promise<{ order: Order; quote: Quote | null }> {
  const db0 = await read();
  const plan = planFor(db0.settings.plan.tier);
  if (db0.settings.plan.docsUsed >= plan.docsLimit) {
    throw new PlanLimitError(`You've used all ${plan.docsLimit} documents on the ${plan.name} plan this month. Upgrade to keep reading orders.`);
  }

  emit(stageMsg("receive", input.file ? `Received ${input.file.name} (${Math.max(1, Math.round(input.file.bytes.length / 1024))} KB)` : `Received ${qty((input.text ?? "").length)} characters of pasted text`));

  emit(stageMsg("read", "Detecting format and reading content…", "start"));
  const doc = await normalize(input);
  const label = { whatsapp: "WhatsApp chat", email: "Email", pdf: "PDF purchase order", image: "Photo / screenshot", text: "Plain-text message" }[doc.type];
  emit(stageMsg("read", `${label}${doc.hints.customerName ? ` from ${doc.hints.customerName}` : ""}${doc.attachments.length ? ` · ${doc.attachments.length} attachment${doc.attachments.length > 1 ? "s" : ""}` : ""}`, "done", { type: doc.type }));

  emit(stageMsg("extract", "Reading the requirement like a procurement clerk would…", "start"));
  const ex = await extract(doc, now, opts);
  const items = toItems(ex.extraction);
  emit(
    stageMsg(
      "extract",
      items.length
        ? `Found ${items.length} line item${items.length > 1 ? "s" : ""} · ${ex.engine === "claude" ? "Claude" : "built-in parser"} · ${Math.round(ex.extraction.overall_confidence * 100)}% confident`
        : "No purchasable items found",
      items.length ? "done" : "error",
      { items: items.map((i) => ({ product: i.product, quantity: i.quantity, unit: i.unit, confidence: i.confidence })), engine: ex.engine, warnings: ex.warnings },
    ),
  );

  if (!items.length) {
    throw new NotAnOrderError(`${ex.extraction.summary} Nothing was saved and it didn't count towards your plan.`);
  }

  emit(stageMsg("match", "Matching specs against supplier catalogs…", "start"));
  const suppliers: Supplier[] = db0.suppliers;
  const comparisons = compareAll(items, suppliers, db0.settings, ex.extraction.delivery_by, now);
  const matched = comparisons.filter((c) => c.offers.length).length;
  const totalOffers = comparisons.reduce((s, c) => s + c.offers.length, 0);
  emit(stageMsg("match", `${matched}/${items.length} items matched · ${totalOffers} supplier offers across ${new Set(comparisons.flatMap((c) => c.offers.map((o) => o.supplierId))).size} mills`));

  emit(stageMsg("compare", "Costing each offer to the door and scoring it…", "start"));
  const savings = comparisons.reduce((s, c) => s + (c.savingsVsAverage ?? 0), 0);
  emit(
    stageMsg("compare", comparisons.length ? `Best suppliers picked${savings > 0 ? ` · ${inr(savings)} below market average` : ""}` : "Nothing to compare", "done", {
      picks: comparisons.map((c) => ({ itemId: c.itemId, supplier: c.offers[0]?.supplierName ?? null, landed: c.offers[0]?.landedCost ?? null })),
    }),
  );

  const result = await mutate((db) => {
    db.counters.order += 1;
    const createdAt = now.toISOString();
    const order: Order = {
      id: uid("ord"),
      ref: `ORD-${db.counters.order}`,
      createdAt,
      updatedAt: createdAt,
      source: { type: doc.type, fileName: doc.fileName, preview: doc.text.slice(0, 4000), chars: doc.text.length },
      customer: {
        name: ex.extraction.customer.name ?? doc.hints.customerName ?? "Unknown buyer",
        company: ex.extraction.customer.company ?? undefined,
        phone: ex.extraction.customer.phone ?? undefined,
        email: ex.extraction.customer.email ?? doc.hints.customerEmail ?? undefined,
        city: ex.extraction.customer.city ?? undefined,
        gstin: ex.extraction.customer.gstin ?? undefined,
      },
      items,
      deliveryBy: ex.extraction.delivery_by,
      deliveryLocation: ex.extraction.delivery_location,
      paymentTerms: ex.extraction.payment_terms,
      notes: ex.extraction.notes ?? undefined,
      clarifications: ex.extraction.clarifications,
      extraction: {
        engine: ex.engine,
        model: ex.model,
        confidence: ex.extraction.overall_confidence,
        durationMs: ex.durationMs,
        summary: ex.extraction.summary,
        language: ex.extraction.language,
        warnings: ex.warnings,
      },
      comparisons,
      status: "extracted",
      timeline: [
        { at: createdAt, kind: "ingest", text: `${label} received${doc.fileName ? ` (${doc.fileName})` : ""}` },
        { at: createdAt, kind: "extract", text: `${items.length} items read by ${ex.engine === "claude" ? `Claude (${ex.model})` : "built-in parser"} in ${duration(ex.durationMs)}` },
        { at: createdAt, kind: "compare", text: `${totalOffers} supplier offers compared` },
      ],
    };
    db.settings.plan.docsUsed += 1;

    let quote: Quote | null = null;
    if (items.length && matched) {
      db.counters.quote += 1;
      quote = buildQuote(order, db.settings, { id: uid("qt"), number: `TQ-${now.getFullYear()}-${String(db.counters.quote).padStart(4, "0")}`, now });
      order.quoteId = quote.id;
      order.status = quote.status === "approved" ? "approved" : "pending_approval";
      order.timeline.push({
        at: createdAt,
        kind: "quote",
        text: `Quote ${quote.number} drafted · ${inr(quote.total)} at ${quote.marginPct.toFixed(1)}% margin`,
      });
      order.timeline.push({
        at: createdAt,
        kind: "approval",
        text: quote.requiresApproval ? `Sent for approval — ${quote.approvalReasons.length} guardrail${quote.approvalReasons.length > 1 ? "s" : ""}` : "Auto-approved — within all guardrails",
        actor: "Taana agent",
      });
      db.quotes.unshift(quote);
    }
    db.orders.unshift(order);
    return { order, quote };
  });

  if (result.quote) {
    const q = result.quote;
    emit(stageMsg("quote", `${q.number} · ${q.lines.length} lines · ${inr(q.total)} incl. GST · ${q.marginPct.toFixed(1)}% margin`, "done", { quoteId: q.id }));
    emit(
      stageMsg(
        "approve",
        q.requiresApproval ? `Needs your approval: ${q.approvalReasons[0]}` : "Auto-approved — ready to send on WhatsApp",
        "done",
        { requiresApproval: q.requiresApproval, reasons: q.approvalReasons },
      ),
    );
  } else {
    emit(stageMsg("quote", items.length ? "No supplier prices yet — RFQs drafted for your mills" : "No quote — nothing to price", items.length ? "done" : "error"));
    emit(stageMsg("approve", "Waiting on supplier prices", "done"));
  }
  return result;
}

// Draft RFQ messages to suppliers for items we can't price (or want fresh quotes on).
export function rfqDrafts(order: Order, suppliers: Supplier[], businessName: string) {
  return order.items.map((item) => {
    const cats = suppliers.filter((s) => s.categories.includes(item.category));
    const spec = [item.specs.count, item.specs.construction, item.specs.gsm && `${item.specs.gsm} GSM`, item.specs.widthInch && `${item.specs.widthInch}"`, item.specs.composition, item.specs.color, item.specs.finish]
      .filter(Boolean)
      .join(", ");
    return {
      itemId: item.id,
      product: item.product,
      suppliers: cats.map((s) => ({
        supplierId: s.id,
        name: s.name,
        phone: s.phone,
        message: `Namaste ${s.contactName.split(" ")[0]} ji, ${businessName} here. Please share your best rate for:\n• ${item.product}${spec ? ` (${spec})` : ""}\n• Qty: ${qty(item.quantity)} ${UNIT_LABEL[item.unit]}${order.deliveryBy ? `\n• Needed by: ${order.deliveryBy}` : ""}\nPlease mention MOQ, stock and dispatch time. Thank you 🙏`,
      })),
    };
  });
}
