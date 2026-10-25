import { runAgent, NotAnOrderError, PlanLimitError } from "@/lib/agent/pipeline";
import { ensureSeeded } from "@/lib/services";
import { sampleById } from "@/lib/samples";
import { textPdf } from "@/lib/pdf";
import type { AgentEvent } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_BYTES = 20 * 1024 * 1024;

// Streams the agent run as newline-delimited JSON so the UI can animate each stage live.
export async function POST(req: Request) {
  await ensureSeeded();
  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "Send multipart form data with a file or text" }, { status: 400 });

  let text = (form.get("text") as string | null)?.trim() || undefined;
  let file: { name: string; type: string; bytes: Uint8Array } | undefined;
  const upload = form.get("file");
  if (upload && typeof upload !== "string" && upload.size > 0) {
    if (upload.size > MAX_BYTES) return Response.json({ error: "File is larger than 20 MB" }, { status: 413 });
    file = { name: upload.name, type: upload.type, bytes: new Uint8Array(await upload.arrayBuffer()) };
  }
  const sampleId = form.get("sample") as string | null;
  if (sampleId) {
    const s = sampleById(sampleId);
    if (!s) return Response.json({ error: "Unknown sample" }, { status: 404 });
    if (s.kind === "pdf") file = { name: s.fileName, type: "application/pdf", bytes: await textPdf(s.title, s.content) };
    else if (s.kind === "email") file = { name: s.fileName, type: "message/rfc822", bytes: new TextEncoder().encode(s.content.replace(/\n/g, "\r\n")) };
    else file = { name: s.fileName, type: "text/plain", bytes: new TextEncoder().encode(s.content) };
    text = undefined;
  }
  if (!text && !file) return Response.json({ error: "Paste a message or attach a file" }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Omit<AgentEvent, "at">) => controller.enqueue(encoder.encode(`${JSON.stringify({ ...e, at: Date.now() })}\n`));
      try {
        const { order, quote } = await runAgent({ text, file }, send);
        send({ stage: "done", status: "done", message: order.extraction.summary, data: { orderId: order.id, quoteId: quote?.id ?? null, ref: order.ref } });
      } catch (err) {
        if (!(err instanceof PlanLimitError || err instanceof NotAnOrderError)) console.error(err);
        send({ stage: "error", status: "error", message: (err as Error).message || "The agent run failed" });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-cache, no-transform", "X-Accel-Buffering": "no" } });
}
