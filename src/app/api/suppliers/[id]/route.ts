import { body, handle, type Ctx } from "@/lib/http";
import { deleteSupplier, upsertSupplier } from "@/lib/services";
import type { Supplier } from "@/lib/types";

export async function PATCH(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => upsertSupplier({ ...(await body<Partial<Supplier> & { name: string }>(req)), id }));
}

export async function DELETE(_: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(() => deleteSupplier(id));
}
