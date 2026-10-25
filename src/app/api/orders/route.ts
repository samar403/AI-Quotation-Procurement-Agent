import { handle } from "@/lib/http";
import { read } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => {
    const db = await read();
    return db.orders.map((o) => {
      const q = db.quotes.find((x) => x.id === o.quoteId);
      return {
        id: o.id,
        ref: o.ref,
        createdAt: o.createdAt,
        status: o.status,
        source: o.source.type,
        customer: o.customer,
        summary: o.extraction.summary,
        items: o.items.length,
        engine: o.extraction.engine,
        confidence: o.extraction.confidence,
        deliveryBy: o.deliveryBy,
        quote: q ? { id: q.id, number: q.number, total: q.total, marginPct: q.marginPct, status: q.status } : null,
      };
    });
  });
}
