import { test } from "node:test";
import assert from "node:assert/strict";
import Anthropic from "@anthropic-ai/sdk";
import { extract, setAnthropicClient } from "../src/lib/agent/extract";
import type { NormalizedDoc } from "../src/lib/ingest/normalize";
import type { ExtractionT } from "../src/lib/agent/schema";

const answer: ExtractionT = {
  is_order: true,
  summary: "Rakesh (Mehta Creations) needs 1 fabric, 3,000 m, by 12 Nov.",
  language: "Hinglish",
  customer: { name: "Rakesh Mehta", company: "Mehta Creations", phone: null, email: null, city: "Ahmedabad", gstin: null },
  items: [
    { raw_text: "poplin make it 3000 mtr", product: "Cotton Poplin", category: "Cotton Fabric", composition: "100% cotton", gsm: null, width_inch: 58, count: "40x40", construction: "132x72", weave: "plain", color: "white", finish: "RFD", quantity: 3000, unit: "m", target_price: 88, notes: null, confidence: 0.93 },
  ],
  delivery_by: "2026-11-12",
  delivery_location: "Ahmedabad",
  payment_terms: "30 days credit",
  notes: null,
  clarifications: [],
  overall_confidence: 0.92,
};

function stub(capture: { url?: string; headers?: Headers; body?: any }, reply: Record<string, unknown>) {
  return new Anthropic({
    apiKey: "test-key",
    baseURL: "https://api.test",
    maxRetries: 0,
    fetch: (async (url: string, init: RequestInit) => {
      capture.url = String(url);
      capture.headers = new Headers(init.headers);
      capture.body = JSON.parse(String(init.body));
      return new Response(JSON.stringify(reply), { status: 200, headers: { "content-type": "application/json" } });
    }) as typeof fetch,
  });
}

const message = (text: string, stop_reason = "end_turn") => ({
  id: "msg_1", type: "message", role: "assistant", model: "claude-opus-5-5", stop_reason, stop_sequence: null,
  content: [{ type: "text", text }], usage: { input_tokens: 10, output_tokens: 10 },
});

test("sends a cached, schema-constrained extraction request and parses the answer", async () => {
  const cap: { url?: string; headers?: Headers; body?: any } = {};
  setAnthropicClient(stub(cap, message(JSON.stringify(answer))));
  const doc: NormalizedDoc = { type: "pdf", fileName: "po.pdf", text: "PO text layer", hints: { customerName: "Rakesh" }, attachments: [{ kind: "pdf", mediaType: "application/pdf", base64: "JVBERi0=", fileName: "po.pdf" }], warnings: [] };
  const r = await extract(doc, new Date("2026-10-25T06:00:00Z"));
  setAnthropicClient(null);

  assert.equal(r.engine, "claude");
  assert.equal(r.extraction.items[0].quantity, 3000);
  assert.match(cap.url!, /\/v1\/messages/);
  assert.match(cap.headers!.get("anthropic-beta") ?? "", /server-side-fallback-2026-07-01/);
  const b = cap.body;
  assert.equal(b.model, "claude-opus-5-5");
  assert.equal(b.fallbacks, "default");
  assert.equal(b.output_config.format.type, "json_schema");
  assert.ok(b.output_config.format.schema.properties.items, "schema describes items");
  assert.equal(b.system[0].cache_control.type, "ephemeral");
  assert.ok(!/2026-10-25/.test(b.system[0].text), "system prompt stays byte-stable for caching");
  const content = b.messages[0].content;
  assert.equal(content[0].type, "document", "PDF goes to Claude natively");
  assert.match(content.at(-1).text, /Today is 2026-10-25/);
  assert.ok(!content.at(-1).text.includes("PO text layer"), "PDF text isn't duplicated");
});

test("falls back to the built-in parser when the model refuses", async () => {
  setAnthropicClient(stub({}, message("", "refusal")));
  const doc: NormalizedDoc = { type: "text", text: "Need 5000m 60x60 cambric 44\" RFD", hints: {}, attachments: [], warnings: [] };
  const r = await extract(doc, new Date("2026-10-25T06:00:00Z"));
  setAnthropicClient(null);
  assert.equal(r.engine, "heuristic");
  assert.equal(r.extraction.items[0].product, "Cotton Cambric");
  assert.ok(r.warnings.some((w) => w.includes("built-in textile parser")));
});
