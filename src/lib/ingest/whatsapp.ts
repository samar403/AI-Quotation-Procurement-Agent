// Parses WhatsApp "Export chat" text files (Android and iOS formats) into messages.
//   Android: 12/10/2026, 10:42 am - Rakesh Mehta: message
//   iOS:     [12/10/26, 10:42:11 AM] Rakesh Mehta: message

export interface ChatMessage {
  at?: string;
  sender: string;
  text: string;
}

const ANDROID = /^(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?\s?m\.?)?)\s+-\s+([^:]+?):\s([\s\S]*)$/i;
const IOS = /^‎?\[(\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?\s*(?:[ap]\.?\s?m\.?)?)\]\s+([^:]+?):\s([\s\S]*)$/i;
const SYSTEM_NOISE = /(messages and calls are end-to-end encrypted|<media omitted>|this message was deleted|image omitted|sticker omitted|missed voice call|created group|added you|changed the subject)/i;

export function looksLikeWhatsApp(text: string): boolean {
  const lines = text.split(/\r?\n/).slice(0, 40);
  return lines.filter((l) => ANDROID.test(l) || IOS.test(l)).length >= 2;
}

export function parseWhatsApp(text: string): ChatMessage[] {
  const out: ChatMessage[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/ /g, " ");
    const m = line.match(ANDROID) ?? line.match(IOS);
    if (m) {
      out.push({ at: `${m[1]} ${m[2]}`.trim(), sender: m[3].trim(), text: m[4].trim() });
    } else if (out.length && line.trim()) {
      out[out.length - 1].text += `\n${line.trim()}`;
    }
  }
  return out.filter((m) => !SYSTEM_NOISE.test(m.text));
}

// The customer is the most frequent sender who isn't the business itself.
export function likelyCustomer(messages: ChatMessage[], businessNames: string[] = []): string | undefined {
  const own = businessNames.map((n) => n.toLowerCase());
  const counts = new Map<string, number>();
  for (const m of messages) {
    if (own.some((o) => m.sender.toLowerCase().includes(o))) continue;
    counts.set(m.sender, (counts.get(m.sender) ?? 0) + m.text.length);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export function chatToTranscript(messages: ChatMessage[]): string {
  return messages.map((m) => `${m.at ? `[${m.at}] ` : ""}${m.sender}: ${m.text}`).join("\n");
}
