import type { CatalogEntry, Category, DB, Settings, Specs, Supplier, Unit } from "./types";
import { LEXICON } from "./lexicon";

// Deterministic PRNG so the demo workspace looks the same on every reset.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

interface BaseItem {
  product: string;
  specs: Specs;
  price: number; // market reference price per unit, INR
  moq: number;
}

// Reference market prices (INR, ex-mill, pre-GST) — realistic 2026 Surat/Tiruppur ranges.
const BASE: BaseItem[] = [
  { product: "Cotton Poplin", specs: { count: "40x40", construction: "132x72", gsm: 110, widthInch: 58, finish: "RFD" }, price: 84, moq: 500 },
  { product: "Cotton Poplin", specs: { count: "60x60", construction: "92x88", gsm: 95, widthInch: 58, finish: "dyed" }, price: 96, moq: 500 },
  { product: "Cotton Cambric", specs: { count: "60x60", gsm: 85, widthInch: 44, finish: "RFD" }, price: 62, moq: 1000 },
  { product: "Cotton Twill", specs: { count: "20x16", gsm: 210, widthInch: 58, finish: "dyed" }, price: 128, moq: 500 },
  { product: "Cotton Canvas", specs: { gsm: 340, widthInch: 60, finish: "greige" }, price: 142, moq: 300 },
  { product: "Cotton Mulmul", specs: { count: "80x80", gsm: 60, widthInch: 44, finish: "RFD" }, price: 58, moq: 1000 },
  { product: "Greige Cotton Sheeting", specs: { count: "30x30", construction: "68x68", gsm: 120, widthInch: 63, finish: "greige" }, price: 49, moq: 2000 },
  { product: "Rayon Challis", specs: { count: "30s", gsm: 140, widthInch: 56, finish: "RFD" }, price: 72, moq: 1000 },
  { product: "Viscose Georgette", specs: { gsm: 90, widthInch: 44, finish: "dyed" }, price: 118, moq: 500 },
  { product: "Modal Satin", specs: { gsm: 110, widthInch: 44, finish: "dyed" }, price: 165, moq: 300 },
  { product: "Polyester Georgette", specs: { gsm: 80, widthInch: 44, finish: "dyed" }, price: 46, moq: 1000 },
  { product: "Polyester Satin", specs: { gsm: 95, widthInch: 58, finish: "dyed" }, price: 54, moq: 1000 },
  { product: "Polyester Chiffon", specs: { gsm: 60, widthInch: 44, finish: "dyed" }, price: 41, moq: 1000 },
  { product: "Nylon Lycra", specs: { gsm: 190, widthInch: 58, finish: "dyed" }, price: 210, moq: 200 },
  { product: "PC Shirting", specs: { composition: "65/35 PC", gsm: 120, widthInch: 58, finish: "dyed" }, price: 68, moq: 800 },
  { product: "Denim", specs: { gsm: 340, widthInch: 58, color: "indigo", count: "10 oz" }, price: 172, moq: 500 },
  { product: "Stretch Denim", specs: { gsm: 320, widthInch: 56, color: "indigo", count: "9.5 oz" }, price: 198, moq: 500 },
  { product: "Single Jersey", specs: { count: "30s", gsm: 160, widthInch: 72, finish: "bio-washed" }, price: 385, moq: 100 },
  { product: "Rib Knit", specs: { count: "30s", gsm: 220, widthInch: 36 }, price: 420, moq: 50 },
  { product: "Fleece", specs: { gsm: 300, widthInch: 72 }, price: 360, moq: 100 },
  { product: "Linen Cotton Blend", specs: { gsm: 150, widthInch: 58, finish: "dyed" }, price: 245, moq: 300 },
  { product: "Cotton Combed Yarn", specs: { count: "30s Ne" }, price: 292, moq: 500 },
  { product: "Cotton Combed Yarn", specs: { count: "40s Ne" }, price: 318, moq: 500 },
  { product: "Cotton Carded Yarn", specs: { count: "20s Ne" }, price: 238, moq: 1000 },
  { product: "Polyester Filament Yarn", specs: { count: "150D/48F", finish: "DTY" }, price: 134, moq: 500 },
  { product: "Viscose Spun Yarn", specs: { count: "30s Ne" }, price: 205, moq: 500 },
  { product: "Sewing Thread", specs: { count: "40/2", composition: "spun polyester" }, price: 38, moq: 500 },
  { product: "Metal Zipper", specs: { count: "#5 YKK-grade, 7 inch" }, price: 9.5, moq: 2000 },
  { product: "Shirt Buttons", specs: { count: "18L 4-hole" }, price: 0.65, moq: 10000 },
];

interface SupplierSeed {
  name: string;
  city: string;
  state: string;
  contactName: string;
  categories: Category[];
  onTimeRate: number;
  qualityScore: number;
  priceBias: number; // multiplier on market price
  leadBase: number;
  paymentTerms: string;
  freight: Partial<Record<Unit, number>>;
  notes: string;
}

const SUPPLIERS: SupplierSeed[] = [
  { name: "Kavya Looms", city: "Surat", state: "Gujarat", contactName: "Hitesh Desai", categories: ["Polyester & Synthetics", "Viscose & Rayon"], onTimeRate: 0.94, qualityScore: 0.88, priceBias: 0.95, leadBase: 6, paymentTerms: "30 days credit", freight: { m: 1.2, kg: 6 }, notes: "Strong on dyed georgette & satin. Ring Hitesh before 11am." },
  { name: "Tapti Synthetics", city: "Surat", state: "Gujarat", contactName: "Farhan Patel", categories: ["Polyester & Synthetics", "Yarn"], onTimeRate: 0.81, qualityScore: 0.79, priceBias: 0.9, leadBase: 4, paymentTerms: "Advance 50%", freight: { m: 1.0, kg: 5 }, notes: "Cheapest poly in Ring Road market; quality varies lot to lot." },
  { name: "Narmada Textile Mills", city: "Ahmedabad", state: "Gujarat", contactName: "Jignesh Shah", categories: ["Cotton Fabric", "Denim", "Linen & Blends"], onTimeRate: 0.91, qualityScore: 0.93, priceBias: 1.02, leadBase: 9, paymentTerms: "45 days credit", freight: { m: 1.8, kg: 7 }, notes: "Export-grade poplin and twill. Lab dips in 3 days." },
  { name: "Indigo Thread Co.", city: "Ahmedabad", state: "Gujarat", contactName: "Rupal Mehta", categories: ["Denim", "Cotton Fabric"], onTimeRate: 0.87, qualityScore: 0.9, priceBias: 0.97, leadBase: 12, paymentTerms: "30 days credit", freight: { m: 1.6 }, notes: "Rope-dyed denim specialist." },
  { name: "Kaveri Knits", city: "Tiruppur", state: "Tamil Nadu", contactName: "S. Senthil", categories: ["Knit Fabric", "Yarn"], onTimeRate: 0.95, qualityScore: 0.91, priceBias: 0.98, leadBase: 7, paymentTerms: "21 days credit", freight: { kg: 9, m: 2.4 }, notes: "Compacted combed jersey, bio-wash in-house." },
  { name: "Saffron Spinners", city: "Coimbatore", state: "Tamil Nadu", contactName: "Lakshmi Narayanan", categories: ["Yarn"], onTimeRate: 0.97, qualityScore: 0.95, priceBias: 1.03, leadBase: 5, paymentTerms: "15 days credit", freight: { kg: 4 }, notes: "Compact combed yarn, consistent CSP." },
  { name: "Bharat Weaving Works", city: "Ichalkaranji", state: "Maharashtra", contactName: "Sunil Patil", categories: ["Cotton Fabric", "Linen & Blends"], onTimeRate: 0.84, qualityScore: 0.85, priceBias: 0.93, leadBase: 10, paymentTerms: "Advance 30%", freight: { m: 1.4 }, notes: "Airjet looms, greige + RFD. Good for bulk cambric." },
  { name: "Malabar Cotton Co.", city: "Erode", state: "Tamil Nadu", contactName: "Rajesh Kumar", categories: ["Cotton Fabric", "Viscose & Rayon"], onTimeRate: 0.89, qualityScore: 0.86, priceBias: 0.96, leadBase: 8, paymentTerms: "30 days credit", freight: { m: 1.5 }, notes: "Rayon prints & mulmul." },
  { name: "Panipat Trim House", city: "Panipat", state: "Haryana", contactName: "Aman Gupta", categories: ["Trims & Accessories", "Knit Fabric"], onTimeRate: 0.92, qualityScore: 0.84, priceBias: 1.0, leadBase: 3, paymentTerms: "Advance 100%", freight: { pcs: 0.05, kg: 8 }, notes: "Zips, buttons, threads, fleece remnants." },
];

const CITY_CODES: Record<string, string> = { Surat: "SUR", Ahmedabad: "AMD", Tiruppur: "TUP", Coimbatore: "CBE", Ichalkaranji: "ICH", Erode: "ERD", Panipat: "PNP" };

function gstin(r: () => number, stateCode: string) {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const pick = () => letters[Math.floor(r() * letters.length)];
  return `${stateCode}${pick()}${pick()}${pick()}${pick()}${pick()}${Math.floor(1000 + r() * 8999)}${pick()}1Z${Math.floor(r() * 9)}`;
}

const STATE_CODES: Record<string, string> = { Gujarat: "24", "Tamil Nadu": "33", Maharashtra: "27", Haryana: "06" };

export function buildSuppliers(now = new Date()): Supplier[] {
  const r = rng(42);
  return SUPPLIERS.map((s, si) => {
    const id = `sup_${String(si + 1).padStart(3, "0")}`;
    const catalog: CatalogEntry[] = [];
    BASE.forEach((b, bi) => {
      const lex = LEXICON.find((l) => l.product === b.product)!;
      if (!s.categories.includes(lex.category)) return;
      if (r() < 0.18) return; // not every supplier carries every SKU
      const jitter = 0.94 + r() * 0.12;
      const price = Math.round(b.price * s.priceBias * jitter * 100) / 100;
      catalog.push({
        id: `cat_${si + 1}_${bi + 1}`,
        sku: `${CITY_CODES[s.city] ?? "GEN"}-${lex.product.split(" ").map((w) => w[0]).join("").toUpperCase()}-${String(bi + 1).padStart(3, "0")}`,
        product: b.product,
        category: lex.category,
        hsn: lex.hsn,
        specs: { ...lex.defaults, ...b.specs },
        unit: lex.unit,
        price: price < 5 ? Math.round(price * 100) / 100 : Math.round(price * 2) / 2,
        moq: Math.round((b.moq * (0.6 + r() * 0.9)) / 50) * 50 || b.moq,
        stock: Math.round((b.moq * (2 + r() * 14)) / 50) * 50,
        leadTimeDays: Math.max(2, Math.round(s.leadBase + (r() - 0.5) * 6)),
        updatedAt: new Date(now.getTime() - Math.floor(r() * 12) * 86400000).toISOString(),
      });
    });
    return {
      id,
      name: s.name,
      city: s.city,
      state: s.state,
      gstin: gstin(r, STATE_CODES[s.state] ?? "24"),
      contactName: s.contactName,
      phone: `+91 9${Math.floor(100000000 + r() * 899999999)}`,
      email: `sales@${s.name.toLowerCase().replace(/[^a-z]+/g, "")}.in`,
      categories: s.categories,
      onTimeRate: s.onTimeRate,
      qualityScore: s.qualityScore,
      paymentTerms: s.paymentTerms,
      freightPerUnit: s.freight,
      catalog,
      notes: s.notes,
      createdAt: new Date(now.getTime() - (90 + si * 11) * 86400000).toISOString(),
    };
  });
}

export function defaultSettings(now = new Date()): Settings {
  return {
    business: {
      name: "Shreeji Textile Traders",
      tagline: "Fabrics · Yarn · Trims — Since 1998",
      gstin: "24AAKCS4821M1Z5",
      address: "412, Millennium Textile Market, Ring Road, Surat 395002, Gujarat",
      phone: "+91 98250 41122",
      email: "quotes@shreejitextiles.in",
      bank: "HDFC Bank · A/C 50200041188231 · IFSC HDFC0000123",
      signatory: "Mahesh Agarwal",
    },
    pricing: {
      defaultMarginPct: 9,
      categoryMargins: {
        "Cotton Fabric": 9,
        "Viscose & Rayon": 10,
        "Polyester & Synthetics": 12,
        Denim: 8,
        "Knit Fabric": 8,
        "Linen & Blends": 12,
        Yarn: 5,
        "Trims & Accessories": 18,
      },
      minMarginPct: 4,
      roundTo: 0.5,
      taxRate: 5,
      quoteValidityDays: 7,
    },
    approval: {
      autoApproveBelow: 300000,
      requireApprovalIfMarginBelow: 6,
      requireApprovalIfConfidenceBelow: 0.7,
      approvers: ["Mahesh Agarwal", "Priya Agarwal"],
    },
    weights: { price: 0.5, lead: 0.2, reliability: 0.2, moq: 0.1 },
    plan: { tier: "growth", docsUsed: 0, periodStart: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), seats: 3 },
  };
}

export function emptyDB(now = new Date()): DB {
  return {
    version: 1,
    settings: defaultSettings(now),
    suppliers: buildSuppliers(now),
    orders: [],
    quotes: [],
    counters: { order: 1040, quote: 230 },
  };
}
