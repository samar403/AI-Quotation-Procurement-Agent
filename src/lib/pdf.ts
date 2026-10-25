import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import type { Quote, Settings } from "./types";
import { fmtDate, UNIT_LABEL } from "./format";

// Branded A4 quotation. Standard PDF fonts have no ₹ glyph, so amounts use "Rs." here.

const INDIGO = rgb(0.13, 0.17, 0.39);
const MADDER = rgb(0.69, 0.25, 0.18);
const TURMERIC = rgb(0.88, 0.65, 0.15);
const MEHENDI = rgb(0.36, 0.48, 0.23);
const INK = rgb(0.13, 0.12, 0.11);
const MUTED = rgb(0.42, 0.4, 0.37);
const RULE = rgb(0.86, 0.83, 0.78);
const PAPER = rgb(0.985, 0.975, 0.955);

const rs = (n: number) => `Rs. ${n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ascii = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/[–—]/g, "-").replace(/₹/g, "Rs.").replace(/·/g, "|").replace(/[^\x20-\x7E]/g, "");

function wrap(text: string, font: PDFFont, size: number, width: number) {
  const words = ascii(text).split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (font.widthOfTextAtSize(next, size) > width && cur) {
      lines.push(cur);
      cur = w;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

function selvedge(page: PDFPage, y: number, width: number) {
  const colors = [INDIGO, MADDER, TURMERIC, MEHENDI];
  for (let x = 0, i = 0; x < width; x += 9, i++) page.drawRectangle({ x, y, width: 6, height: 5, color: colors[i % colors.length] });
}

export async function quotePdf(q: Quote, s: Settings): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`Quotation ${q.number}`);
  doc.setAuthor(s.business.name);
  doc.setCreator("Taana Procurement Agent");
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const serif = await doc.embedFont(StandardFonts.TimesRomanBold);

  const W = 595.28;
  const H = 841.89;
  const M = 42;
  let page = doc.addPage([W, H]);
  page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
  selvedge(page, H - 8, W);

  const text = (p: PDFPage, t: string, x: number, y: number, size = 9, font = regular, color = INK) => p.drawText(ascii(t), { x, y, size, font, color });
  const right = (p: PDFPage, t: string, x: number, y: number, size = 9, font = regular, color = INK) => text(p, t, x - font.widthOfTextAtSize(ascii(t), size), y, size, font, color);

  // Header
  let y = H - 58;
  text(page, s.business.name, M, y, 20, serif, INDIGO);
  text(page, s.business.tagline, M, y - 15, 8.5, regular, MUTED);
  wrap(s.business.address, regular, 8.5, 260).forEach((l, i) => text(page, l, M, y - 29 - i * 11, 8.5, regular, MUTED));
  text(page, `GSTIN ${s.business.gstin}  |  ${s.business.phone}  |  ${s.business.email}`, M, y - 52, 8, regular, MUTED);

  right(page, "QUOTATION", W - M, y, 22, serif, MADDER);
  right(page, q.number + (q.revision > 1 ? `  (rev ${q.revision})` : ""), W - M, y - 16, 10, bold);
  right(page, `Date: ${fmtDate(q.updatedAt)}`, W - M, y - 30, 8.5, regular, MUTED);
  right(page, `Valid until: ${fmtDate(q.validUntil)}`, W - M, y - 42, 8.5, regular, MUTED);
  right(page, `Ref: ${q.orderRef}`, W - M, y - 54, 8.5, regular, MUTED);

  y -= 78;
  page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.8, color: RULE });

  // Bill to
  y -= 18;
  text(page, "QUOTED TO", M, y, 7.5, bold, MUTED);
  text(page, "DELIVERY", W / 2 + 10, y, 7.5, bold, MUTED);
  y -= 14;
  text(page, q.customer.company || q.customer.name, M, y, 11, bold);
  text(page, q.deliveryBy ? `By ${fmtDate(q.deliveryBy)}` : "7-10 days from confirmation", W / 2 + 10, y, 10, bold);
  y -= 13;
  const cust = [q.customer.company ? `Attn: ${q.customer.name}` : "", q.customer.city ?? "", q.customer.phone ?? "", q.customer.email ?? "", q.customer.gstin ? `GSTIN ${q.customer.gstin}` : ""].filter(Boolean);
  cust.forEach((c, i) => text(page, c, M, y - i * 11, 8.5, regular, MUTED));
  y -= Math.max(cust.length, 1) * 11 + 16;

  // Table
  // Right edges for numeric columns; description wraps inside its own column.
  const cols = { n: M, desc: M + 22, descW: 218, hsn: M + 252, qtyR: M + 352, rateR: M + 432, amtR: W - M - 6 };
  const header = () => {
    page.drawRectangle({ x: M, y: y - 6, width: W - 2 * M, height: 20, color: INDIGO });
    text(page, "#", cols.n + 4, y, 8, bold, rgb(1, 1, 1));
    text(page, "DESCRIPTION", cols.desc, y, 8, bold, rgb(1, 1, 1));
    text(page, "HSN", cols.hsn, y, 8, bold, rgb(1, 1, 1));
    right(page, "QTY", cols.qtyR, y, 8, bold, rgb(1, 1, 1));
    right(page, "RATE", cols.rateR, y, 8, bold, rgb(1, 1, 1));
    right(page, "AMOUNT", cols.amtR, y, 8, bold, rgb(1, 1, 1));
    y -= 24;
  };
  header();
  q.lines.forEach((l, i) => {
    const [name, spec] = l.description.split(" — ");
    const desc = [...wrap(name, bold, 8.5, cols.descW), ...(spec ? wrap(spec, regular, 8, cols.descW) : [])];
    const nameLines = wrap(name, bold, 8.5, cols.descW).length;
    const h = Math.max(desc.length * 11, 11) + 10;
    if (y - h < 170) {
      page = doc.addPage([W, H]);
      page.drawRectangle({ x: 0, y: 0, width: W, height: H, color: PAPER });
      selvedge(page, H - 8, W);
      y = H - 60;
      header();
    }
    if (i % 2 === 1) page.drawRectangle({ x: M, y: y - h + 12, width: W - 2 * M, height: h, color: rgb(0.955, 0.94, 0.915) });
    text(page, String(i + 1), cols.n + 4, y, 8.5, bold, MUTED);
    desc.forEach((d, j) => text(page, d, cols.desc, y - j * 11, j < nameLines ? 8.5 : 8, j < nameLines ? bold : regular, j < nameLines ? INK : MUTED));
    text(page, l.hsn, cols.hsn, y, 8.5, regular, MUTED);
    right(page, `${l.quantity.toLocaleString("en-IN")} ${UNIT_LABEL[l.unit]}`, cols.qtyR, y, 8.5);
    right(page, rs(l.unitPrice), cols.rateR, y, 8.5);
    right(page, rs(l.amount), cols.amtR, y, 8.5, bold);
    y -= h;
  });
  page.drawLine({ start: { x: M, y: y + 6 }, end: { x: W - M, y: y + 6 }, thickness: 0.8, color: RULE });

  // Totals
  y -= 10;
  const totalsX = W - M - 200;
  const row = (label: string, value: string, strong = false) => {
    text(page, label, totalsX, y, strong ? 10.5 : 9, strong ? bold : regular, strong ? INK : MUTED);
    right(page, value, cols.amtR, y, strong ? 11 : 9, strong ? bold : regular, strong ? INDIGO : INK);
    y -= strong ? 20 : 15;
  };
  row("Subtotal", rs(q.subtotal));
  row(`GST @ ${q.taxRate}%`, rs(q.tax));
  y -= 6;
  page.drawRectangle({ x: totalsX - 8, y: y - 8, width: W - M - totalsX + 8, height: 24, color: rgb(0.93, 0.91, 0.87) });
  row("Grand total", rs(q.total), true);

  // Terms + signature
  y -= 6;
  text(page, "TERMS", M, y, 7.5, bold, MUTED);
  y -= 13;
  for (const t of q.terms) {
    for (const [j, l] of wrap(t, regular, 8.2, W - 2 * M - 180).entries()) {
      text(page, `${j === 0 ? "-" : " "} ${l}`, M, y, 8.2, regular, INK);
      y -= 11;
    }
  }
  y -= 8;
  text(page, `Bank: ${s.business.bank}`, M, y, 8, regular, MUTED);

  const sy = Math.min(y, 150);
  right(page, `For ${s.business.name}`, W - M, sy + 34, 9, bold);
  page.drawLine({ start: { x: W - M - 150, y: sy + 6 }, end: { x: W - M, y: sy + 6 }, thickness: 0.6, color: MUTED });
  right(page, `${s.business.signatory}, Authorised signatory`, W - M, sy - 6, 8, regular, MUTED);

  if (q.status === "approved" || q.status === "sent" || q.status === "won") {
    page.drawEllipse({ x: W - M - 230, y: sy + 16, xScale: 46, yScale: 22, borderColor: MEHENDI, borderWidth: 1.6, opacity: 0, borderOpacity: 0.8 });
    text(page, "APPROVED", W - M - 258, sy + 12, 11, bold, MEHENDI);
  }

  selvedge(page, 0, W);
  text(page, "Prepared with Taana - AI quotation & procurement for textiles", M, 18, 7, regular, MUTED);
  return doc.save();
}

// Renders a plain-text document (e.g. a sample PO) into a simple PDF with a real text layer.
export async function textPdf(title: string, body: string): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([595.28, 841.89]);
  let y = 790;
  body.split("\n").forEach((line, i) => {
    const f = i === 0 ? bold : font;
    const size = i === 0 ? 16 : 10;
    for (const l of wrap(line || " ", f, size, 500)) {
      page.drawText(l, { x: 48, y, size, font: f, color: INK });
      y -= size + 6;
    }
  });
  return doc.save();
}
