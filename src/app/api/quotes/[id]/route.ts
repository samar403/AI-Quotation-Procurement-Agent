import { body, handle, type Ctx } from "@/lib/http";
import { read } from "@/lib/db";
import { NotFound, updateQuoteLine } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => {
    const db = await read();
    const quote = db.quotes.find((q) => q.id === id || q.number === id);
    if (!quote) throw new NotFound("Quote not found");
    return { quote, settings: db.settings };
  });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => {
    const b = await body<{ itemId: string; marginPct?: number; unitPrice?: number; by?: string }>(req);
    return updateQuoteLine(id, b.itemId, { marginPct: b.marginPct, unitPrice: b.unitPrice }, b.by);
  });
}
