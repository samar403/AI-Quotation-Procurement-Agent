import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWhatsApp, looksLikeWhatsApp, likelyCustomer } from "../src/lib/ingest/whatsapp";
import { normalize } from "../src/lib/ingest/normalize";
import { heuristicExtract } from "../src/lib/agent/heuristic";
import { toItems } from "../src/lib/agent/pipeline";
import { compareItem, specMatch } from "../src/lib/agent/compare";
import { buildQuote, priceLine, totals } from "../src/lib/agent/quote";
import { buildSuppliers, defaultSettings } from "../src/lib/seed";
import { SAMPLES } from "../src/lib/samples";
import { detectProduct } from "../src/lib/lexicon";
import type { Order } from "../src/lib/types";

const TODAY = new Date("2026-10-25T06:00:00Z");
const sample = (id: string) => SAMPLES.find((s) => s.id === id)!.content;

test("parses Android and iOS WhatsApp exports and finds the buyer", () => {
  const android = "24/10/2026, 10:41 am - Rakesh: hi\n24/10/2026, 10:42 am - Shreeji Textiles: ji\n24/10/2026, 10:43 am - Rakesh: need poplin\ncontinued line";
  assert.ok(looksLikeWhatsApp(android));
  const msgs = parseWhatsApp(android);
  assert.equal(msgs.length, 3);
  assert.equal(msgs[2].text, "need poplin\ncontinued line");
  assert.equal(likelyCustomer(msgs, ["shreeji"]), "Rakesh");

  const ios = "[24/10/26, 10:41:02 AM] Priya: hello\n[24/10/26, 10:42:10 AM] Priya: 200 kg jersey";
  assert.equal(parseWhatsApp(ios).length, 2);
});

test("lexicon prefers the most specific product", () => {
  assert.equal(detectProduct("2000m stretch denim 9 oz")?.product, "Stretch Denim");
  assert.equal(detectProduct("viscose georgette 44 inch")?.product, "Viscose Georgette");
  assert.equal(detectProduct("georgette 44 inch")?.product, "Polyester Georgette");
});

test("reads the Hinglish WhatsApp sample, applying the buyer's correction", async () => {
  const doc = await normalize({ text: sample("mehta-whatsapp") });
  assert.equal(doc.type, "whatsapp");
  const x = heuristicExtract(doc, TODAY);
  assert.equal(x.items.length, 3);
  const poplin = x.items.find((i) => i.product === "Cotton Poplin")!;
  assert.equal(poplin.quantity, 3000, "correction 'make it 3000 not 2500' applied");
  assert.equal(poplin.count, "40x40");
  assert.equal(poplin.construction, "132x72");
  assert.equal(poplin.width_inch, 58);
  assert.equal(poplin.target_price, 88);
  assert.equal(x.delivery_by, "2026-11-12");
  assert.equal(x.customer.company, "Mehta Creations", "doesn't confuse the seller's name for the buyer's");
  assert.equal(x.customer.gstin, "24AAHFM5521K1Z3");
  assert.equal(x.payment_terms, "30 days credit");
});

test("reads quantities with Indian digit grouping and keeps blends intact", async () => {
  const doc = await normalize({ text: sample("vastra-po") });
  const x = heuristicExtract(doc, TODAY);
  const pc = x.items.find((i) => i.product === "PC Shirting")!;
  assert.equal(pc.quantity, 2200, "'65/35 PC' is a blend, not 35 pieces");
  assert.equal(pc.unit, "m");
  const denim = x.items.find((i) => i.product === "Denim")!;
  assert.equal(denim.gsm, 339, "10 oz converted to GSM");
  assert.equal(x.items.find((i) => i.product === "Metal Zipper")!.quantity, 5000);
  assert.equal(x.customer.name, "Kunal Joshi");
});

test("email: delivery window from the body, not the Date header", async () => {
  const doc = await normalize({ text: sample("anaya-email") });
  assert.equal(doc.type, "email");
  const x = heuristicExtract(doc, TODAY);
  assert.equal(x.delivery_by, "2026-11-09");
  assert.equal(x.items.find((i) => i.product === "Single Jersey")!.quantity, 1200);
  assert.equal(x.items.find((i) => i.product === "Cotton Combed Yarn")!.count, "40s");
});

test("splits several quantities on one line into separate items", async () => {
  const doc = await normalize({ text: "Poplin 40x40 58\" white 2000 mtr, navy 1500 mtr" });
  const x = heuristicExtract(doc, TODAY);
  assert.deepEqual(
    x.items.map((i) => [i.color, i.quantity]),
    [["white", 2000], ["navy", 1500]],
  );
});

test("spec matching rewards exact specs and rejects wrong units", () => {
  const [item] = toItems(heuristicExtract({ type: "text", text: "Rayon challis 30s 140 gsm 56\" 1000 mtr", hints: {}, attachments: [], warnings: [] }, TODAY));
  const cat = { id: "c", sku: "s", product: "Rayon Challis", category: "Viscose & Rayon" as const, hsn: "5516", specs: { count: "30s", gsm: 140, widthInch: 56 }, unit: "m" as const, price: 70, moq: 100, stock: 9999, leadTimeDays: 5, updatedAt: "" };
  assert.ok(specMatch(item, cat) > 0.95);
  assert.equal(specMatch(item, { ...cat, unit: "kg" }), 0);
  assert.ok(specMatch(item, { ...cat, specs: { ...cat.specs, gsm: 200 } }) < specMatch(item, cat));
});

test("comparison penalises suppliers that would miss the deadline", () => {
  const settings = defaultSettings(TODAY);
  const suppliers = buildSuppliers(TODAY);
  const [item] = toItems(heuristicExtract({ type: "text", text: "Denim 10 oz indigo 58\" 2000 m", hints: {}, attachments: [], warnings: [] }, TODAY));
  const tight = compareItem(item, suppliers, settings, "2026-10-29", TODAY);
  assert.ok(tight.offers.length >= 2);
  for (const o of tight.offers) if (o.leadTimeDays > 4) assert.ok(o.flags.some((f) => f.includes("misses deadline")));
  const relaxed = compareItem(item, suppliers, settings, "2026-12-30", TODAY);
  assert.equal(relaxed.offers.every((o) => !o.flags.some((f) => f.includes("misses deadline"))), true);
  assert.equal(relaxed.selectedSupplierId, relaxed.offers[0].supplierId);
});

test("quote pricing: margin, rounding, GST and guardrails", () => {
  assert.equal(priceLine(100, 10, 0.5), 110);
  assert.equal(priceLine(81.2, 9, 0.5), 89);
  assert.equal(priceLine(0.6, 18, 0.5), 0.71, "sub-₹5 items keep paise");
  const t = totals([{ amount: 1000, costPrice: 9, quantity: 100 } as never], 5);
  assert.deepEqual([t.subtotal, t.tax, t.total, t.grossProfit], [1000, 50, 1050, 100]);

  const settings = defaultSettings(TODAY);
  const suppliers = buildSuppliers(TODAY);
  const items = toItems(heuristicExtract({ type: "text", text: "Poplin 40x40 132x72 58\" white RFD 300 mtr", hints: {}, attachments: [], warnings: [] }, TODAY));
  const order: Order = {
    id: "o", ref: "ORD-1", createdAt: TODAY.toISOString(), updatedAt: TODAY.toISOString(), source: { type: "text", preview: "", chars: 0 },
    customer: { name: "Test" }, items, clarifications: [], comparisons: items.map((i) => compareItem(i, suppliers, settings, null, TODAY)),
    extraction: { engine: "heuristic", confidence: 0.9, durationMs: 1, summary: "", warnings: [] }, status: "extracted", timeline: [],
  };
  const small = buildQuote(order, settings, { id: "q", number: "TQ-1", now: TODAY });
  assert.equal(small.lines[0].marginPct >= settings.pricing.categoryMargins["Cotton Fabric"]!, true);
  assert.equal(small.taxRate, 5);
  assert.ok(Math.abs(small.total - small.subtotal * 1.05) < 0.02);
  const lowMargin = buildQuote(order, settings, { id: "q", number: "TQ-1", now: TODAY, overrides: { [items[0].id]: { marginPct: 2 } } });
  assert.equal(lowMargin.status, "pending_approval");
  assert.ok(lowMargin.approvalReasons.some((r) => r.includes("Margin")));
  assert.ok(lowMargin.drafts.whatsapp.includes("TQ-1"));
});
