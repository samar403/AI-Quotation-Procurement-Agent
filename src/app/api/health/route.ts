import { aiEnabled, MODEL } from "@/lib/agent/extract";

export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({ ok: true, ai: aiEnabled(), model: aiEnabled() ? MODEL : null });
}
