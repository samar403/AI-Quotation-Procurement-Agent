import { body, handle } from "@/lib/http";
import { read } from "@/lib/db";
import { upsertSupplier } from "@/lib/services";
import type { Supplier } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => (await read()).suppliers);
}

export async function POST(req: Request) {
  return handle(async () => upsertSupplier(await body<Partial<Supplier> & { name: string }>(req)));
}
