import type { Category, Specs, Unit } from "./types";

// Canonical textile vocabulary. Used three ways:
//  1. Given to Claude so extracted product names line up with supplier catalogs.
//  2. By the offline heuristic parser to recognise products in free text.
//  3. By the matcher to map a requirement onto catalog SKUs.
export interface LexiconEntry {
  product: string;
  category: Category;
  hsn: string;
  unit: Unit;
  keywords: string[]; // lowercase; any hit is a candidate, longer hits win
  defaults?: Specs;
}

export const LEXICON: LexiconEntry[] = [
  { product: "Cotton Poplin", category: "Cotton Fabric", hsn: "5208", unit: "m", keywords: ["poplin", "popline", "cotton poplin"], defaults: { composition: "100% cotton", weave: "plain" } },
  { product: "Cotton Cambric", category: "Cotton Fabric", hsn: "5208", unit: "m", keywords: ["cambric", "cambrik"], defaults: { composition: "100% cotton", weave: "plain" } },
  { product: "Cotton Voile", category: "Cotton Fabric", hsn: "5208", unit: "m", keywords: ["voile", "cotton voile"], defaults: { composition: "100% cotton" } },
  { product: "Cotton Twill", category: "Cotton Fabric", hsn: "5209", unit: "m", keywords: ["twill", "drill", "cotton twill", "gabardine"], defaults: { composition: "100% cotton", weave: "twill" } },
  { product: "Cotton Canvas", category: "Cotton Fabric", hsn: "5209", unit: "m", keywords: ["canvas", "duck"], defaults: { composition: "100% cotton" } },
  { product: "Cotton Mulmul", category: "Cotton Fabric", hsn: "5208", unit: "m", keywords: ["mulmul", "mul mul", "muslin"], defaults: { composition: "100% cotton" } },
  { product: "Greige Cotton Sheeting", category: "Cotton Fabric", hsn: "5208", unit: "m", keywords: ["greige", "grey fabric", "gray fabric", "sheeting", "kora"], defaults: { composition: "100% cotton", finish: "greige" } },
  { product: "Rayon Challis", category: "Viscose & Rayon", hsn: "5516", unit: "m", keywords: ["rayon", "challis", "reyon"], defaults: { composition: "100% viscose" } },
  { product: "Viscose Georgette", category: "Viscose & Rayon", hsn: "5408", unit: "m", keywords: ["viscose georgette"], defaults: { composition: "100% viscose" } },
  { product: "Modal Satin", category: "Viscose & Rayon", hsn: "5408", unit: "m", keywords: ["modal", "modal satin"], defaults: { composition: "modal" } },
  { product: "Polyester Georgette", category: "Polyester & Synthetics", hsn: "5407", unit: "m", keywords: ["georgette", "poly georgette", "polyester georgette"], defaults: { composition: "100% polyester" } },
  { product: "Polyester Satin", category: "Polyester & Synthetics", hsn: "5407", unit: "m", keywords: ["satin", "armani satin", "poly satin"], defaults: { composition: "100% polyester", weave: "satin" } },
  { product: "Polyester Chiffon", category: "Polyester & Synthetics", hsn: "5407", unit: "m", keywords: ["chiffon"], defaults: { composition: "100% polyester" } },
  { product: "Nylon Lycra", category: "Polyester & Synthetics", hsn: "5407", unit: "m", keywords: ["lycra", "nylon lycra", "spandex"], defaults: { composition: "nylon/spandex" } },
  { product: "PC Shirting", category: "Polyester & Synthetics", hsn: "5513", unit: "m", keywords: ["pc shirting", "poly cotton", "polycotton", "pc fabric", "65/35", "shirting"], defaults: { composition: "65/35 PC" } },
  { product: "Denim", category: "Denim", hsn: "5209", unit: "m", keywords: ["denim", "jeans fabric", "indigo denim"], defaults: { composition: "100% cotton", weave: "twill", color: "indigo" } },
  { product: "Stretch Denim", category: "Denim", hsn: "5211", unit: "m", keywords: ["stretch denim", "lycra denim", "power stretch"], defaults: { composition: "98/2 cotton spandex", weave: "twill" } },
  { product: "Single Jersey", category: "Knit Fabric", hsn: "6006", unit: "kg", keywords: ["single jersey", "jersey", "sj"], defaults: { composition: "100% cotton", weave: "jersey" } },
  { product: "Rib Knit", category: "Knit Fabric", hsn: "6006", unit: "kg", keywords: ["rib", "1x1 rib", "2x2 rib"], defaults: { composition: "cotton/spandex" } },
  { product: "Fleece", category: "Knit Fabric", hsn: "6001", unit: "kg", keywords: ["fleece", "terry", "loopknit", "french terry"], defaults: { composition: "cotton/poly" } },
  { product: "Linen Cotton Blend", category: "Linen & Blends", hsn: "5309", unit: "m", keywords: ["linen", "linen blend", "lenin"], defaults: { composition: "55/45 linen cotton" } },
  { product: "Cotton Combed Yarn", category: "Yarn", hsn: "5205", unit: "kg", keywords: ["combed yarn", "cotton yarn", "ne yarn", "combed"], defaults: { composition: "100% cotton" } },
  { product: "Cotton Carded Yarn", category: "Yarn", hsn: "5205", unit: "kg", keywords: ["carded yarn", "carded"], defaults: { composition: "100% cotton" } },
  { product: "Polyester Filament Yarn", category: "Yarn", hsn: "5402", unit: "kg", keywords: ["polyester yarn", "poly yarn", "fdy", "poy", "dty", "filament"], defaults: { composition: "100% polyester" } },
  { product: "Viscose Spun Yarn", category: "Yarn", hsn: "5510", unit: "kg", keywords: ["viscose yarn", "vsf yarn", "spun yarn"], defaults: { composition: "100% viscose" } },
  { product: "Sewing Thread", category: "Trims & Accessories", hsn: "5401", unit: "pcs", keywords: ["thread", "sewing thread", "dhaga"], defaults: {} },
  { product: "Metal Zipper", category: "Trims & Accessories", hsn: "9607", unit: "pcs", keywords: ["zip", "zipper", "chain"], defaults: {} },
  { product: "Shirt Buttons", category: "Trims & Accessories", hsn: "9606", unit: "pcs", keywords: ["button", "buttons", "batan"], defaults: {} },
];

export const HSN_BY_CATEGORY: Record<Category, string> = {
  "Cotton Fabric": "5208",
  "Viscose & Rayon": "5516",
  "Polyester & Synthetics": "5407",
  Denim: "5209",
  "Knit Fabric": "6006",
  "Linen & Blends": "5309",
  Yarn: "5205",
  "Trims & Accessories": "9606",
};

export function lexiconFor(product: string): LexiconEntry | undefined {
  const p = product.toLowerCase();
  return (
    LEXICON.find((e) => e.product.toLowerCase() === p) ??
    LEXICON.find((e) => e.keywords.some((k) => p.includes(k)))
  );
}

// Longest keyword hit wins so "stretch denim" beats "denim" and "viscose georgette" beats "georgette".
export function detectProduct(text: string): LexiconEntry | undefined {
  const t = ` ${text.toLowerCase()} `;
  let best: { entry: LexiconEntry; len: number } | undefined;
  for (const entry of LEXICON) {
    for (const k of entry.keywords) {
      const re = new RegExp(`(^|[^a-z])${k.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}([^a-z]|$)`);
      if (re.test(t) && (!best || k.length > best.len)) best = { entry, len: k.length };
    }
  }
  return best?.entry;
}
