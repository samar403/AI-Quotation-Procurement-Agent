import type { SourceType } from "../types";
import { chatToTranscript, likelyCustomer, looksLikeWhatsApp, parseWhatsApp } from "./whatsapp";

// Turns any upload into a NormalizedDoc: plain text for the parsers plus, where useful,
// the original binary so Claude can read PDFs and images natively.

export interface Attachment {
  kind: "pdf" | "image";
  mediaType: string;
  base64: string;
  fileName: string;
}

export interface NormalizedDoc {
  type: SourceType;
  fileName?: string;
  text: string;
  hints: { customerName?: string; customerEmail?: string; customerPhone?: string; subject?: string; receivedAt?: string };
  attachments: Attachment[];
  warnings: string[];
}

export interface RawInput {
  text?: string;
  file?: { name: string; type: string; bytes: Uint8Array };
}

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

function extOf(name: string) {
  return name.toLowerCase().split(".").pop() ?? "";
}

function toBase64(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64");
}

export async function pdfText(bytes: Uint8Array): Promise<string> {
  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(bytes));
    const { text } = await extractText(pdf, { mergePages: true });
    return Array.isArray(text) ? text.join("\n") : text;
  } catch {
    return "";
  }
}

function fromText(text: string, fileName?: string): NormalizedDoc {
  if (looksLikeWhatsApp(text)) {
    const msgs = parseWhatsApp(text);
    return {
      type: "whatsapp",
      fileName,
      text: chatToTranscript(msgs),
      hints: { customerName: likelyCustomer(msgs, ["shreeji", "you"]), receivedAt: msgs.at(-1)?.at },
      attachments: [],
      warnings: [],
    };
  }
  if (/^(from|subject|to):/im.test(text.slice(0, 600)) && /^subject:/im.test(text.slice(0, 2000))) {
    const from = text.match(/^from:\s*(.+)$/im)?.[1]?.trim();
    const subject = text.match(/^subject:\s*(.+)$/im)?.[1]?.trim();
    const email = from?.match(/[\w.+-]+@[\w-]+\.[\w.]+/)?.[0];
    const name = from?.replace(/<.*>/, "").replace(/"/g, "").trim();
    return { type: "email", fileName, text, hints: { customerName: name && name !== email ? name : undefined, customerEmail: email, subject }, attachments: [], warnings: [] };
  }
  return { type: "text", fileName, text, hints: {}, attachments: [], warnings: [] };
}

async function fromEml(bytes: Uint8Array, fileName: string): Promise<NormalizedDoc> {
  const PostalMime = (await import("postal-mime")).default;
  const email = await PostalMime.parse(bytes);
  const body = email.text || (email.html ?? "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
  const attachments: Attachment[] = [];
  const extra: string[] = [];
  const warnings: string[] = [];
  for (const att of email.attachments ?? []) {
    const data = typeof att.content === "string" ? new TextEncoder().encode(att.content) : new Uint8Array(att.content as ArrayBuffer);
    const name = att.filename ?? "attachment";
    if (att.mimeType === "application/pdf" || extOf(name) === "pdf") {
      attachments.push({ kind: "pdf", mediaType: "application/pdf", base64: toBase64(data), fileName: name });
      const t = await pdfText(data);
      if (t) extra.push(`--- Attachment: ${name} ---\n${t}`);
    } else if (IMAGE_TYPES.includes(att.mimeType)) {
      attachments.push({ kind: "image", mediaType: att.mimeType, base64: toBase64(data), fileName: name });
      warnings.push(`Image attachment "${name}" needs AI vision to read.`);
    } else if (att.mimeType.startsWith("text/")) {
      extra.push(`--- Attachment: ${name} ---\n${new TextDecoder().decode(data)}`);
    }
  }
  const header = [
    email.from ? `From: ${email.from.name ? `${email.from.name} <${email.from.address}>` : email.from.address}` : "",
    email.subject ? `Subject: ${email.subject}` : "",
    email.date ? `Date: ${email.date}` : "",
  ].filter(Boolean).join("\n");
  return {
    type: "email",
    fileName,
    text: [header, body.trim(), ...extra].filter(Boolean).join("\n\n"),
    hints: { customerName: email.from?.name || undefined, customerEmail: email.from?.address || undefined, subject: email.subject || undefined, receivedAt: email.date || undefined },
    attachments,
    warnings,
  };
}

export async function normalize(input: RawInput): Promise<NormalizedDoc> {
  if (input.file) {
    const { name, type, bytes } = input.file;
    const ext = extOf(name);
    if (type === "application/pdf" || ext === "pdf") {
      const text = await pdfText(bytes);
      return {
        type: "pdf",
        fileName: name,
        text: [input.text, text].filter(Boolean).join("\n\n"),
        hints: {},
        attachments: [{ kind: "pdf", mediaType: "application/pdf", base64: toBase64(bytes), fileName: name }],
        warnings: text ? [] : ["No text layer found in this PDF — it looks scanned. AI vision is needed to read it."],
      };
    }
    if (IMAGE_TYPES.includes(type) || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
      const mediaType = IMAGE_TYPES.includes(type) ? type : ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";
      return {
        type: "image",
        fileName: name,
        text: input.text ?? "",
        hints: {},
        attachments: [{ kind: "image", mediaType, base64: toBase64(bytes), fileName: name }],
        warnings: [],
      };
    }
    if (ext === "eml" || type === "message/rfc822") return fromEml(bytes, name);
    const text = new TextDecoder().decode(bytes);
    const doc = fromText([input.text, text].filter(Boolean).join("\n\n"), name);
    return doc;
  }
  return fromText(input.text ?? "");
}
