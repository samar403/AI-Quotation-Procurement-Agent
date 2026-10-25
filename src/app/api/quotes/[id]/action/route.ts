import { body, handle, type Ctx } from "@/lib/http";
import { quoteAction } from "@/lib/services";

export async function POST(req: Request, { params }: Ctx) {
  const { id } = await params;
  return handle(async () => {
    const b = await body<{ action: "approve" | "reject" | "send" | "won" | "lost" | "reopen"; by?: string; note?: string; channel?: string }>(req);
    return quoteAction(id, b.action, b.by, b.note, b.channel);
  });
}
