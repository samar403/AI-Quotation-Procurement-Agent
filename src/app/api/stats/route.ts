import { handle } from "@/lib/http";
import { stats } from "@/lib/services";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(stats);
}
