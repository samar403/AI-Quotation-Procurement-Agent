import { body, handle } from "@/lib/http";
import { read } from "@/lib/db";
import { updateSettings } from "@/lib/services";
import type { Settings } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return handle(async () => (await read()).settings);
}

export async function PATCH(req: Request) {
  return handle(async () => updateSettings(await body<Partial<Settings>>(req)));
}
