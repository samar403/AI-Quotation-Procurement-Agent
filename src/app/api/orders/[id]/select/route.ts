import { body, handle, type Ctx } from "@/lib/http";
import { selectSupplier } from "@/lib/services";

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => {
    const b = await body<{ itemId: string; supplierId: string; by?: string }>(req);
    return selectSupplier(id, b.itemId, b.supplierId, b.by);
  });
}
