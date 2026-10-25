import { handle } from "@/lib/http";
import { resetDemo } from "@/lib/services";

export const maxDuration = 120;

export async function POST() {
  return handle(async () => {
    const db = await resetDemo();
    return { ok: true, orders: db.orders.length };
  });
}
