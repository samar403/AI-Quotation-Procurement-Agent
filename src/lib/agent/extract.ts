import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { Extraction, type ExtractionT } from "./schema";
import { EXTRACTION_SYSTEM_PROMPT, extractionUserPrompt } from "./prompt";
import { heuristicExtract } from "./heuristic";
import type { NormalizedDoc } from "../ingest/normalize";

export const MODEL = process.env.TAANA_MODEL || "claude-opus-5-5";
type Effort = "low" | "medium" | "high" | "xhigh" | "max";
const EFFORT = (process.env.TAANA_EFFORT as Effort) || "medium";

export function aiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN || client);
}

export interface ExtractResult {
  extraction: ExtractionT;
  engine: "claude" | "heuristic";
  model?: string;
  durationMs: number;
  warnings: string[];
}

let client: Anthropic | null = null;
function anthropic() {
  client ??= new Anthropic();
  return client;
}

// Lets tests drive the real SDK against a stubbed transport.
export function setAnthropicClient(c: Anthropic | null) {
  client = c;
}

async function claudeExtract(doc: NormalizedDoc, today: string): Promise<ExtractionT> {
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  for (const a of doc.attachments) {
    if (a.kind === "pdf") {
      content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: a.base64 }, title: a.fileName });
    } else {
      content.push({ type: "image", source: { type: "base64", media_type: a.mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif", data: a.base64 } });
    }
  }
  // When a PDF is attached Claude reads it directly; sending its extracted text too would only
  // duplicate tokens. Emails keep their body text since attachments are additional context.
  const text = doc.type === "pdf" ? "" : doc.text;
  content.push({
    type: "text",
    text: extractionUserPrompt({
      today,
      sourceType: doc.type,
      fileName: doc.fileName,
      hints: { "Likely customer": doc.hints.customerName, "Customer email": doc.hints.customerEmail, "Email subject": doc.hints.subject, "Received at": doc.hints.receivedAt },
      text,
    }),
  });

  const response = await anthropic().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: EFFORT, format: betaZodOutputFormat(Extraction) },
    system: [{ type: "text", text: EXTRACTION_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content }],
  });

  if (response.stop_reason === "refusal") throw new Error("The AI model declined to read this document.");
  if (response.stop_reason === "max_tokens") throw new Error("The document was too long to finish reading in one pass.");
  if (!response.parsed_output) throw new Error("The AI response could not be parsed.");
  return response.parsed_output;
}

export async function extract(doc: NormalizedDoc, now = new Date(), opts: { forceHeuristic?: boolean } = {}): Promise<ExtractResult> {
  const started = Date.now();
  const today = now.toISOString().slice(0, 10);
  const warnings = [...doc.warnings];
  const needsVision = doc.type === "image" || (doc.type === "pdf" && !doc.text.trim()) || doc.attachments.some((a) => a.kind === "image");

  if (aiEnabled() && !opts.forceHeuristic) {
    try {
      const extraction = await claudeExtract(doc, today);
      return { extraction, engine: "claude", model: MODEL, durationMs: Date.now() - started, warnings: warnings.filter((w) => !/needs AI vision/.test(w)) };
    } catch (err) {
      const reason =
        err instanceof Anthropic.AuthenticationError ? "the API key was rejected"
        : err instanceof Anthropic.RateLimitError ? "the AI service is rate-limiting requests"
        : err instanceof Anthropic.APIConnectionError ? "the AI service could not be reached"
        : err instanceof Anthropic.APIError ? `the AI service returned an error (${err.status})`
        : (err as Error).message;
      warnings.push(`AI extraction unavailable — ${reason}. Used the built-in textile parser instead; please review.`);
    }
  } else if (needsVision) {
    warnings.push("This file needs AI vision to read. Add ANTHROPIC_API_KEY to enable photo and scanned-PDF reading.");
  }

  const extraction = heuristicExtract(doc, now);
  return { extraction, engine: "heuristic", durationMs: Date.now() - started, warnings };
}
