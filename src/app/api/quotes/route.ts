import { handle } from "@/lib/http";
import { read } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => (await read()).quotes);
}
