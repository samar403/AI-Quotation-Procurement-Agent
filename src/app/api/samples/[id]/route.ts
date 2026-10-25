import { sampleById } from "@/lib/samples";
import { textPdf } from "@/lib/pdf";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const s = sampleById(id);
  if (!s) return Response.json({ error: "Unknown sample" }, { status: 404 });
  const bytes = s.kind === "pdf" ? await textPdf(s.title, s.content) : new TextEncoder().encode(s.content);
  const type = s.kind === "pdf" ? "application/pdf" : s.kind === "email" ? "message/rfc822" : "text/plain; charset=utf-8";
  return new Response(Buffer.from(bytes), { headers: { "Content-Type": type, "Content-Disposition": `attachment; filename="${s.fileName}"` } });
}
