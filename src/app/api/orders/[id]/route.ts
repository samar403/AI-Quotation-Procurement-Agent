import { body, handle, type Ctx } from "@/lib/http";
import { deleteOrder, getOrder, updateOrderItems } from "@/lib/services";
import type { Order, RequirementItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(() => getOrder(id));
}

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => {
    const b = await body<{ items?: RequirementItem[]; deliveryBy?: string | null; deliveryLocation?: string | null; customer?: Order["customer"]; by?: string }>(req);
    return updateOrderItems(id, b, b.by);
  });
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(() => deleteOrder(id));
}
