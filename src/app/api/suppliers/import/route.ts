import { handle } from "@/lib/http";
import { BadRequest, importCatalogCsv } from "@/lib/services";

export async function POST(req: Request) {
  return handle(async () => {
    const csv = await req.text();
    if (!csv.trim()) throw new BadRequest("Paste or upload a CSV price list");
    return importCatalogCsv(csv);
  });
}
