// Writes the in-app samples to /samples as real files you can upload: `npx tsx scripts/make-samples.ts`.
import { writeFileSync, mkdirSync } from "node:fs";
import { SAMPLES } from "../src/lib/samples";
import { textPdf } from "../src/lib/pdf";

mkdirSync("samples", { recursive: true });
for (const s of SAMPLES) {
  const bytes = s.kind === "pdf" ? await textPdf(s.title, s.content) : new TextEncoder().encode(s.kind === "email" ? s.content.replace(/\n/g, "\r\n") : s.content);
  writeFileSync(`samples/${s.fileName}`, bytes);
  console.log(`samples/${s.fileName}`);
}
writeFileSync(
  "samples/price-list.csv",
  `supplier,product,category,price,unit,moq,stock,lead_time_days,gsm,width,count,composition,color,finish
Kavya Looms,Polyester Georgette,Polyester & Synthetics,44.5,m,1000,15000,5,80,44,,100% polyester,,dyed
Narmada Textile Mills,Cotton Poplin,Cotton Fabric,86,m,500,9000,8,110,58,40x40,100% cotton,white,RFD
Sutlej Woollens,Linen Cotton Blend,Linen & Blends,238,m,300,4000,9,150,58,,55/45 linen cotton,,dyed
`,
);
console.log("samples/price-list.csv");
