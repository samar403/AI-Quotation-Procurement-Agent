import { handle, type Ctx } from "@/lib/http";
import { read } from "@/lib/db";
import { rfqDrafts } from "@/lib/agent/pipeline";
import { NotFound } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => {
    const db = await read();
    const order = db.orders.find((o) => o.id === id);
    if (!order) throw new NotFound("Order not found");
    return rfqDrafts(order, db.suppliers, db.settings.business.name);
  });
}
