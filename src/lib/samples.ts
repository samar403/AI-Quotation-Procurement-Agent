// Realistic sample requirements so anyone can try the full flow in one click.
// The same content lives in /samples as real files (WhatsApp export, .eml, PDF PO).

export interface Sample {
  id: string;
  title: string;
  kind: "whatsapp" | "email" | "text" | "pdf";
  from: string;
  blurb: string;
  fileName: string;
  content: string; // text content (PDF samples are generated server-side from this)
}

export const SAMPLES: Sample[] = [
  {
    id: "mehta-whatsapp",
    title: "Hinglish WhatsApp order",
    kind: "whatsapp",
    from: "Rakesh Mehta · Mehta Creations, Ahmedabad",
    blurb: "3 fabrics spread across 9 messages, with a quantity correction and a deadline.",
    fileName: "WhatsApp Chat with Rakesh Mehta.txt",
    content: `24/10/2026, 10:41 am - Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.
24/10/2026, 10:41 am - Rakesh Mehta: Namaste bhai
24/10/2026, 10:42 am - Rakesh Mehta: Diwali ke baad ka order hai, rate bhejo
24/10/2026, 10:43 am - Rakesh Mehta: 1) Poplin 40x40 132x72 58" white RFD – 2500 mtr @ 88
24/10/2026, 10:43 am - Rakesh Mehta: 2) Rayon challis 30s 140 gsm 56" navy – 1800 mtr
24/10/2026, 10:44 am - Shreeji Textiles: Ji Rakesh bhai, delivery kab tak chahiye?
24/10/2026, 10:46 am - Rakesh Mehta: 12 Nov tak Ahmedabad godown me chahiye
24/10/2026, 10:47 am - Rakesh Mehta: aur 600 mtr polyester satin 58" maroon bhi add karo
24/10/2026, 10:52 am - Rakesh Mehta: sorry poplin make it 3000 mtr not 2500
24/10/2026, 10:53 am - Rakesh Mehta: payment 30 days credit as usual. Mehta Creations, GST 24AAHFM5521K1Z3`,
  },
  {
    id: "anaya-email",
    title: "Email RFQ from a garment exporter",
    kind: "email",
    from: "Priya Nair · Anaya Garments, Tiruppur",
    blurb: "Knits, yarn and trims for an export programme — 45-day credit, 15-day window.",
    fileName: "RFQ - SS27 knit programme.eml",
    content: `From: Priya Nair <priya.nair@anayagarments.in>
To: quotes@shreejitextiles.in
Subject: RFQ - Knit & yarn requirement for SS27 programme
Date: Fri, 23 Oct 2026 16:05:00 +0530
Content-Type: text/plain; charset=utf-8

Hi team,

Please quote your best rates for the below, delivery to Tiruppur within 15 days:

- Single jersey, 100% combed cotton, 30s, 160 GSM, 72" dia, bio-washed, white - 1,200 kg
- 1x1 Rib 30s 220 GSM white - 250 kg
- Cotton combed yarn 40s Ne - 2,000 kg
- Sewing thread 40/2 spun polyester - 1,500 pcs

Payment 45 days credit. Please share MOQ and dispatch time.

Regards,
Priya Nair
Sourcing Manager, Anaya Garments Pvt Ltd
+91 98940 22318
GSTIN 33AAJCA7781P1Z9`,
  },
  {
    id: "vastra-po",
    title: "PDF purchase order",
    kind: "pdf",
    from: "Vastra Retail LLP, Jaipur",
    blurb: "A formal PO with denim, twill, PC shirting and zippers.",
    fileName: "PO-VR-2026-118.pdf",
    content: `VASTRA RETAIL LLP
Purchase Order PO-VR-2026-118
Date: 22 Oct 2026
Buyer: Vastra Retail LLP, MI Road, Jaipur 302001 | GSTIN 08AAMFV2290Q1Z4
Contact: Kunal Joshi, +91 94140 66120, kunal@vastraretail.in

Line items
1. Denim 10 oz indigo 58" - 4,000 m - target Rs 175
2. Cotton twill 20x16 210 GSM 58" khaki dyed - 1,500 m
3. PC shirting 65/35 PC 120 GSM 58" sky blue - 2,200 m
4. Metal zipper 7 inch - 5,000 pcs

Delivery by 20 Nov 2026 to Jaipur warehouse
Payment: 50% advance, balance against delivery`,
  },
  {
    id: "imran-text",
    title: "Two-line urgent text",
    kind: "text",
    from: "Imran Shaikh · Bhiwandi",
    blurb: "Terse, urgent, no colour — watch the agent ask the right follow-ups.",
    fileName: "message.txt",
    content: `Imran Shaikh (Bhiwandi): Need 5000m 60x60 cambric 44" RFD urgent, and 800 kg 150D/48F poly yarn DTY. Rate?`,
  },
];

export const sampleById = (id: string) => SAMPLES.find((s) => s.id === id);
