import { handle, type Ctx } from "@/lib/http";
import { read } from "@/lib/db";
import { NotFound } from "@/lib/services";
import { quotePdf } from "@/lib/pdf";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => {
    const db = await read();
    const quote = db.quotes.find((q) => q.id === id || q.number === id);
    if (!quote) throw new NotFound("Quote not found");
    const bytes = await quotePdf(quote, db.settings);
    const inline = new URL(req.url).searchParams.has("inline");
    return new Response(Buffer.from(bytes), {
      headers: { "Content-Type": "application/pdf", "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${quote.number}.pdf"` },
    });
  });
}
