import type { ExtractionT } from "./schema";
import { detectProduct } from "../lexicon";
import type { NormalizedDoc } from "../ingest/normalize";

// Offline, rule-based reader for textile requirements. It covers the common shapes of trade
// messages (one item per line, Hinglish quantities, market shorthand) so the product works
// without an API key and as a safety net if the AI call fails. Claude handles the long tail.

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const COLORS = [
  "off white", "off-white", "sky blue", "navy blue", "royal blue", "bottle green", "olive green", "light grey", "dark grey", "baby pink",
  "white", "black", "navy", "red", "maroon", "beige", "cream", "olive", "grey", "gray", "pink", "yellow", "green", "mustard", "indigo",
  "khaki", "brown", "peach", "lavender", "teal", "wine", "rust", "orange", "purple", "blue", "ecru", "natural", "assorted",
];
const UNIT_MAP: Array<[RegExp, ExtractionT["items"][number]["unit"], number]> = [
  [/^(m|mt|mts|mtr|mtrs|meter|meters|metre|metres)$/i, "m", 1],
  [/^(kg|kgs|kilo|kilos|kilogram|kilograms)$/i, "kg", 1],
  [/^(pc|pcs|piece|pieces|nos|no)$/i, "pcs", 1],
  [/^(dozen|dzn|doz)$/i, "pcs", 12],
  [/^(gross)$/i, "pcs", 144],
  [/^(roll|rolls|than|thaan|thans|bale|bales)$/i, "roll", 1],
  [/^(yd|yds|yard|yards)$/i, "yard", 1],
];

const QTY_RE = /(?<![\d/.,])(\d+(?:[.,]\d+)*)\s*(k|thousand|hazaar|hazar|lakh|lac)?\s*(meters?|metres?|mtrs?|mts?|mt|m|kgs?|kilos?|kilograms?|pcs|pc|pieces?|nos|dozen|dzn|doz|gross|rolls?|thaans?|thans?|bales?|yards?|yds?|yd)(?![a-z])/i;

function num(s: string) {
  return Number(s.replace(/,/g, ""));
}

function parseQuantity(line: string): { quantity: number; unit: ExtractionT["items"][number]["unit"] } | null {
  // Ignore widths like 58" and counts like 40x40 by requiring a unit word.
  const m = line.match(QTY_RE);
  if (!m) return null;
  let q = num(m[1]);
  const mult = m[2]?.toLowerCase();
  if (mult === "k" || mult === "thousand" || mult === "hazaar" || mult === "hazar") q *= 1000;
  if (mult === "lakh" || mult === "lac") q *= 100000;
  for (const [re, unit, factor] of UNIT_MAP) if (re.test(m[3])) return { quantity: q * factor, unit };
  return null;
}

function parseSpecs(line: string) {
  const l = line.toLowerCase();
  const gsm = l.match(/(\d{2,3})\s*gsm/)?.[1] ?? l.match(/gsm\s*[:\-]?\s*(\d{2,3})/)?.[1];
  const width =
    l.match(/(\d{2,3})\s*(?:"|''|”|inch(?:es)?|in\b|inc\b)/)?.[1] ??
    l.match(/(?:width|panna|pana)\s*[:\-]?\s*(\d{2,3})/)?.[1];
  const pairs = [...l.matchAll(/(\d{2,3})\s*[s']?\s*[x×*]\s*(\d{2,3})\s*s?/g)].map((p) => [Number(p[1]), Number(p[2])]);
  let count: string | null = null;
  let construction: string | null = null;
  for (const [a, b] of pairs) {
    if (a <= 100 && b <= 100 && !count) count = `${a}x${b}`;
    else if (!construction) construction = `${a}x${b}`;
  }
  const yarnCount = l.match(/\b(\d{1,3})\s*(?:s|'s|ne)\b/)?.[1];
  if (!count && yarnCount) count = `${yarnCount}s`;
  const denier = l.match(/\b(\d{2,3})\s*d(?:\s*\/\s*(\d{1,3})\s*f)?\b/);
  if (!count && denier) count = denier[2] ? `${denier[1]}D/${denier[2]}F` : `${denier[1]}D`;
  const oz = l.match(/(\d+(?:\.\d+)?)\s*oz/)?.[1];
  if (oz && !count) count = `${oz} oz`;
  const color = COLORS.find((c) => new RegExp(`(^|[^a-z])${c}([^a-z]|$)`).test(l)) ?? null;
  const finish = l.match(/\b(rfd|pfd|greige|grey|kora|dyed|printed|mercerised|mercerized|bio[- ]?wash(?:ed)?|peached|dty|fdy|poy)\b/)?.[1] ?? null;
  const pct = line.match(/(\d{2,3}\s*%\s*(?:combed\s+|organic\s+|bci\s+|carded\s+)?[a-z]+(?:\s*\/\s*\d{1,3}\s*%?\s*[a-z]+)?)/i)?.[1] ?? null;
  const pc = l.match(/\b(\d{2})\s*\/\s*(\d{2})\s*(pc|poly ?cotton|cvc)\b/);
  const price =
    l.match(/(?:@|rate|price|target|₹|rs\.?|inr)\s*[:\-]?\s*(\d+(?:\.\d+)?)/)?.[1] ??
    l.match(/(\d+(?:\.\d+)?)\s*(?:rs|₹|\/-)\s*(?:per|\/)?\s*(?:m|mtr|kg|pc)?\b/)?.[1] ??
    l.match(/(\d+(?:\.\d+)?)\s*tak\s*chalega/)?.[1];
  return {
    gsm: gsm ? Number(gsm) : oz ? Math.round(Number(oz) * 33.9) : null,
    width_inch: width ? Number(width) : null,
    count,
    construction,
    color: color === "gray" ? "grey" : color,
    finish: finish === "kora" || finish === "grey" ? "greige" : finish && /^(rfd|pfd|dty|fdy|poy)$/.test(finish) ? finish.toUpperCase() : finish,
    composition: pc ? `${pc[1]}/${pc[2]} PC` : pct,
    target_price: price ? Number(price) : null,
  };
}

function parseDate(lines: string[], today: Date): string | null {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  for (const line of lines) {
    const l = line.toLowerCase();
    if (/^(date|sent|received):/.test(l)) continue; // email headers are not delivery dates
    const within = l.match(/(?:within|in|next)\s*(\d{1,2})\s*(?:days?|din)/) ?? l.match(/(\d{1,2})\s*(?:days?|din)\s*(?:me|mein|main|ke andar)/);
    if (within && !/credit|payment/.test(l.slice(l.indexOf(within[0]), l.indexOf(within[0]) + within[0].length + 10))) {
      return iso(new Date(today.getTime() + Number(within[1]) * 86400000));
    }
    if (!/(by|before|till|until|deliver|delivery|dispatch|need|chahiye|tak|required|eta)/.test(l)) continue;
    const dm = l.match(/(\d{1,2})(?:st|nd|rd|th)?\s*(?:of\s*)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/);
    const md = l.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(\d{1,2})(?:st|nd|rd|th)?/);
    const hit = dm ? { d: Number(dm[1]), m: MONTHS.indexOf(dm[2]) } : md ? { d: Number(md[2]), m: MONTHS.indexOf(md[1]) } : null;
    if (hit) {
      let d = new Date(Date.UTC(today.getUTCFullYear(), hit.m, hit.d));
      if (d.getTime() < today.getTime() - 86400000) d = new Date(Date.UTC(today.getUTCFullYear() + 1, hit.m, hit.d));
      return iso(d);
    }
    const numeric = l.match(/(?:by|before|till|delivery)\s*(?:on\s*)?(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?/);
    if (numeric) {
      const y = numeric[3] ? (numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3])) : today.getUTCFullYear();
      return iso(new Date(Date.UTC(y, Number(numeric[2]) - 1, Number(numeric[1]))));
    }
  }
  if (lines.some((l) => /\b(urgent|jaldi|asap|immediately)\b/i.test(l))) return iso(new Date(today.getTime() + 5 * 86400000));
  return null;
}

// Split "white 2000m, navy 1500m" into one segment per quantity while keeping "1,200 kg" and
// leading specs intact: separators only split when they sit between two quantities.
function segmentsOf(line: string): string[] {
  const qtyCount = [...line.matchAll(new RegExp(QTY_RE.source, "gi"))].length;
  if (qtyCount <= 1) return [line];
  const parts = line.split(/\s*(?:;|,(?!\d{3}\b)|\band\b|\+|\baur\b|\balso\b)\s*/i).filter(Boolean);
  const out: string[] = [];
  let buf = "";
  for (const p of parts) {
    buf = buf ? `${buf}, ${p}` : p;
    if (parseQuantity(p)) {
      out.push(buf);
      buf = "";
    }
  }
  if (buf && out.length) out[out.length - 1] += `, ${buf}`;
  else if (buf) out.push(buf);
  return out;
}

function stripChatPrefix(line: string) {
  return line.replace(/^\[[^\]]*\]\s*/, "");
}

export function heuristicExtract(doc: NormalizedDoc, today = new Date()): ExtractionT {
  const text = doc.text;
  const lines = text.split(/\r?\n/).map((l) => stripChatPrefix(l).trim()).filter(Boolean);

  // In chats, drop lines spoken by the business itself.
  const customerName = doc.hints.customerName;
  const ownLine = (l: string) => doc.type === "whatsapp" && customerName && /^[^:]{1,40}:/.test(l) && !l.startsWith(`${customerName}:`);
  const buyerLines = lines.filter((l) => !ownLine(l)).map((l) => (doc.type === "whatsapp" ? l.replace(/^[^:]{1,40}:\s*/, "") : l));

  const items: ExtractionT["items"] = [];
  let lastProductLine: string | null = null;
  for (const raw of buyerLines) {
    // A single line can hold several items: "white 2000m, navy 1500m".
    const product = detectProduct(raw);
    if (product) lastProductLine = raw;
    for (const seg of segmentsOf(raw)) {
      const q = parseQuantity(seg);
      if (!q) continue;
      const p = detectProduct(seg) ?? product ?? (lastProductLine ? detectProduct(lastProductLine) : undefined);
      if (!p) continue;
      // Specs come from the segment when it names its own product, else from the whole line
      // (or the line that last named a product, for follow-ups like "navy 1500m bhi").
      const contextLine = detectProduct(seg) && seg !== raw ? seg : product ? raw : `${lastProductLine ?? ""} ${raw}`;
      const s = { ...parseSpecs(contextLine), ...Object.fromEntries(Object.entries(parseSpecs(seg)).filter(([, v]) => v != null)) };
      // Correction handling: "make it 3000 not 2000" overrides the previous item of the same product.
      const correction = /\b(make it|instead|not|change to|revise|update)\b/i.test(seg);
      const prev = items.findLast((i) => i.product === p.product && (i.color ?? null) === (s.color ?? i.color ?? null));
      if (correction && prev) {
        prev.quantity = q.quantity;
        prev.notes = `Corrected by buyer: "${seg.trim()}"`;
        continue;
      }
      let confidence = 0.55;
      if (detectProduct(seg)) confidence += 0.1;
      if (s.gsm || s.count) confidence += 0.1;
      if (s.width_inch) confidence += 0.05;
      if (s.color) confidence += 0.05;
      items.push({
        raw_text: seg.trim(),
        product: p.product,
        category: p.category,
        composition: s.composition ?? p.defaults?.composition ?? null,
        gsm: s.gsm ?? null,
        width_inch: s.width_inch ?? null,
        count: s.count ?? null,
        construction: s.construction ?? null,
        weave: p.defaults?.weave ?? null,
        color: s.color ?? null,
        finish: s.finish ?? null,
        quantity: q.quantity,
        unit: q.unit,
        target_price: s.target_price ?? null,
        notes: null,
        confidence: Math.min(0.85, confidence),
      });
    }
  }

  // Identity fields come from the buyer's own words so the business's name isn't mistaken for theirs.
  const buyerText = doc.type === "whatsapp" ? buyerLines.join("\n") : text;
  const email = buyerText.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0] ?? doc.hints.customerEmail ?? null;
  const phone = buyerText.match(/(?:\+91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}/)?.[0] ?? null;
  const company =
    buyerText.match(/\b([A-Z][\w&.']*(?:\s+[A-Z][\w&.']*){0,3}\s+(?:Textiles?|Fashions?|Creations?|Exports?|Garments?|Industries|Apparels?|Mills?|Traders?|Enterprises?|Clothing|Pvt\.?\s*Ltd\.?|LLP))\b/)?.[1] ?? null;
  const gstin = buyerText.match(/\b\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]\b/)?.[0] ?? null;
  const location =
    text.match(/\b([A-Z][a-z]{3,})\s+(?:godown|warehouse|factory|unit)\b/)?.[1] ??
    text.match(/(?:deliver(?:y)?\s*(?:to|at|in)|ship\s*to|godown\s*(?:in|at)?|dispatch\s*to)\s*[:\-]?\s*([A-Z][A-Za-z]+(?:[ ,]+[A-Z][A-Za-z]+)?)/)?.[1] ?? null;
  const payment = text.match(/(\d{1,3}\s*days?\s*(?:credit|payment|pdc))|(\d{1,3}\s*%\s*advance)|(full advance|advance payment|against delivery|cod)/i)?.[0] ?? null;
  const deliveryBy = parseDate(buyerLines, today);

  const clarifications: string[] = [];
  for (const it of items) {
    const label = `${it.product}${it.color ? ` (${it.color})` : ""}`;
    if (!it.color && it.category !== "Yarn" && !/^(greige|rfd|pfd)$/i.test(it.finish ?? "")) clarifications.push(`Which colour/shade for ${label}?`);
    if (!it.width_inch && ["Cotton Fabric", "Viscose & Rayon", "Polyester & Synthetics", "Denim", "Linen & Blends"].includes(it.category)) clarifications.push(`What width is needed for ${label} — 44" or 58"?`);
  }
  if (!deliveryBy && items.length) clarifications.push("By when do you need delivery?");

  const byUnit = new Map<string, number>();
  for (const i of items) byUnit.set(i.unit, (byUnit.get(i.unit) ?? 0) + i.quantity);
  const totals = [...byUnit].map(([u, q]) => `${Math.round(q).toLocaleString("en-IN")} ${u === "roll" ? "rolls" : u === "yard" ? "yd" : u}`).join(" + ");
  const lead = text.match(/^\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s*(?:\(([^)]+)\))?\s*:/);
  const contact = text.match(/(?:contact|attn|attention|contact person)\s*[:\-]\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/i)?.[1];
  const name = customerName ?? (doc.hints.customerName || contact || (doc.type === "text" ? lead?.[1] : undefined) || null);
  const city = location ?? (doc.type === "text" ? lead?.[2] ?? null : null);
  const overall = items.length ? items.reduce((s, i) => s + i.confidence, 0) / items.length : 0.2;
  const hinglish = /\b(chahiye|bhejo|kitna|rate kya|jaldi|hai|karo|din me|tak)\b/i.test(text);

  return {
    is_order: items.length > 0,
    summary: items.length
      ? `${name ?? "Buyer"}${company ? ` (${company})` : ""} needs ${items.length} item${items.length > 1 ? "s" : ""}, ~${totals} in total${deliveryBy ? ` by ${deliveryBy}` : ""}${location ? ` in ${location}` : ""}.`
      : "No purchasable items were recognised in this document.",
    language: hinglish ? "Hinglish" : "English",
    customer: { name, company, phone, email, city, gstin },
    items,
    delivery_by: deliveryBy,
    delivery_location: location,
    payment_terms: payment,
    notes: doc.hints.subject ?? null,
    clarifications: [...new Set(clarifications)].slice(0, 6),
    overall_confidence: Math.round(overall * 100) / 100,
  };
}
