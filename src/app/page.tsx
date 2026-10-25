import Link from "next/link";
import { PLANS } from "@/lib/plans";
import { Icon } from "@/components/icons";

function HeroDemo() {
  // A forwarded WhatsApp order becomes woven threads, then a stamped quotation.
  return (
    <div className="card" style={{ padding: 22, position: "relative", overflow: "hidden", boxShadow: "var(--shadow-lg)" }}>
      <div className="spread" style={{ marginBottom: 12 }}>
        <span className="eyebrow">Forwarded · Rakesh Mehta</span>
        <span className="badge b-mehendi">Live</span>
      </div>
      <div className="wa-wall" style={{ borderRadius: 12 }}>
        <div className="chat-demo">
          {[
            ["Poplin 40x40 58\" white RFD – 2500 mtr @ 88", "10:43"],
            ["Rayon challis 30s 140 gsm navy – 1800 mtr", "10:43"],
            ["12 Nov tak Ahmedabad godown me chahiye 🙏", "10:46"],
            ["sorry poplin make it 3000 mtr not 2500", "10:52"],
          ].map(([t, at], i) => (
            <div key={i} className="bubble wa" style={{ animationDelay: `${0.3 + i * 0.45}s`, border: 0 }}>
              {t}
              <small>{at}</small>
            </div>
          ))}
        </div>
      </div>
      <svg viewBox="0 0 400 60" width="100%" height="60" aria-hidden style={{ display: "block", margin: "10px 0" }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <path
            key={i}
            d={`M0 ${10 + i * 10} C 120 ${10 + i * 10}, 140 ${30}, 200 30 S 280 ${10 + i * 10}, 400 ${10 + i * 10}`}
            stroke={["var(--indigo)", "var(--madder)", "var(--turmeric)", "var(--mehendi)", "var(--kasturi)"][i]}
            strokeWidth="3"
            fill="none"
            strokeDasharray="420"
            strokeDashoffset="420"
            style={{ animation: `draw 1.4s ${2.2 + i * 0.12}s forwards cubic-bezier(.6,0,.2,1)` }}
          />
        ))}
      </svg>
      <div className="billbook" style={{ padding: "16px 18px 16px 46px", boxShadow: "none", animation: "drop .6s 3.2s both" }}>
        <div className="stamp" style={{ ["--sc" as string]: "var(--mehendi)", top: 12, right: 14, fontSize: 12, animationDelay: "4s" }}>
          APPROVED
          <small>Mahesh · 10:53</small>
        </div>
        <div className="bill-title" style={{ fontSize: 22 }}>Quotation</div>
        <div className="num faint" style={{ fontSize: 12 }}>TQ-2026-0234 · valid 7 days</div>
        <table className="bill-lines" style={{ fontSize: 12.5 }}>
          <tbody>
            <tr><td>Cotton Poplin 40x40 · 58″</td><td className="right num">3,000 m</td><td className="right num">₹94.50</td></tr>
            <tr><td>Rayon Challis 30s · 140 GSM</td><td className="right num">1,800 m</td><td className="right num">₹79.00</td></tr>
            <tr><td>Polyester Satin · 58″ maroon</td><td className="right num">600 m</td><td className="right num">₹57.50</td></tr>
          </tbody>
        </table>
        <div className="spread" style={{ marginTop: 8 }}>
          <span className="faint" style={{ fontSize: 12 }}>Best of 6 mills · 9.8% margin</span>
          <b className="num">₹4,83,210</b>
        </div>
      </div>
      <style>{`@keyframes draw{to{stroke-dashoffset:0}}`}</style>
    </div>
  );
}

const STEPS = [
  ["Forward anything", "WhatsApp chat exports, emails with PO attachments, PDFs, even a photo of a handwritten list. Hinglish and market shorthand welcome — “40x40 poplin 2k mtr chahiye”."],
  ["The agent reads it", "Claude turns the mess into a requirement sheet: product, count, construction, GSM, width, colour, quantity, deadline — and asks only the questions that change the price."],
  ["Mills compete", "Every line is matched to your suppliers’ price lists, costed to the door with freight, and scored on price, lead time vs. deadline, reliability and MOQ."],
  ["You approve, it sends", "A margin-safe quotation is drafted. Inside your guardrails it’s auto-approved; outside, it waits for one tap. Then it goes out on WhatsApp or email."],
];

const FEATURES: Array<[string, string, keyof typeof Icon]> = [
  ["Reads how the trade talks", "Multi-message chats, corrections (“make it 3000 not 2500”), Hinglish, oz-to-GSM, counts vs. construction, gross and dozens.", "Chat"],
  ["Landed cost, not list price", "Mill rate + freight per metre or kilo, so the cheapest-looking mill doesn’t quietly eat your margin.", "Mill"],
  ["Deadline-aware sourcing", "A mill with a 12-day lead time can’t win a 9-day order, no matter how cheap.", "Clock"],
  ["Margin guardrails", "Category margins, a hard floor, value limits and low-confidence flags decide what needs a human.", "Alert"],
  ["One-tap approvals", "Approvers see exactly which guardrail tripped, adjust a margin inline, and stamp it.", "Check"],
  ["RFQs to your mills", "No price on file? It drafts the WhatsApp RFQ to every supplier who deals in that category.", "Send"],
];

export default function Landing() {
  return (
    <div className="landing">
      <div className="weave-banner" />
      <nav className="l-nav">
        <Link href="/" className="row" style={{ gap: 10 }}>
          <img src="/favicon.svg" width={30} height={30} alt="" />
          <span className="brand-name">taana</span>
        </Link>
        <div className="row">
          <a href="#how" className="btn btn-ghost hide-sm">How it works</a>
          <a href="#pricing" className="btn btn-ghost hide-sm">Pricing</a>
          <Link href="/desk" className="btn btn-primary">
            Open the desk <Icon.Arrow size={16} />
          </Link>
        </div>
      </nav>

      <section className="l-hero">
        <div>
          <div className="eyebrow" style={{ marginBottom: 16 }}>AI quotation & procurement · for textile traders</div>
          <h1>
            Forward the order.
            <br />
            <em>Approve</em> the quote.
          </h1>
          <p className="lead">
            Taana reads the WhatsApp messages, PDFs and emails your buyers send, compares every line against your mills’ prices, and drafts a{" "}
            <span className="thread-underline">margin-safe quotation in under a minute</span> — waiting only for your nod.
          </p>
          <div className="row wrap" style={{ gap: 12 }}>
            <Link href="/desk/intake?sample=mehta-whatsapp" className="btn btn-primary btn-lg">
              <Icon.Spark /> Watch it read a real order
            </Link>
            <Link href="/desk" className="btn btn-lg">
              Explore the demo desk
            </Link>
          </div>
          <div className="row wrap faint" style={{ marginTop: 22, fontSize: 13, gap: 18 }}>
            <span className="row" style={{ gap: 6 }}><Icon.Chat size={15} /> WhatsApp exports</span>
            <span className="row" style={{ gap: 6 }}><Icon.Mail size={15} /> Email & .eml</span>
            <span className="row" style={{ gap: 6 }}><Icon.Pdf size={15} /> PDF POs</span>
            <span className="row" style={{ gap: 6 }}><Icon.Image size={15} /> Photos of lists</span>
          </div>
        </div>
        <HeroDemo />
      </section>

      <section className="l-section" style={{ paddingTop: 32 }}>
        <div className="grid g3">
          {[
            ["2–4 hrs", "a trading desk spends today turning one enquiry into a rate — calls to 3–5 mills, a calculator, a typed WhatsApp."],
            ["< 60 s", "for Taana to read the order, cost it across every mill in your network and draft the quotation."],
            ["1–3%", "of margin quietly lost on quotes priced from memory — freight forgotten, an old rate, a missed MOQ."],
          ].map(([n, t]) => (
            <div key={n} className="card card-pad">
              <div className="price-big" style={{ color: "var(--indigo)" }}>{n}</div>
              <p className="muted" style={{ margin: "6px 0 0" }}>{t}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="l-section" id="how">
        <div className="eyebrow">How it works</div>
        <h2 style={{ margin: "8px 0 28px", maxWidth: "18ch" }}>Four steps from “rate bhejo” to a sent quotation.</h2>
        <div className="grid g4">
          {STEPS.map(([t, d], i) => (
            <div key={t} className="card step-card">
              <span className="n">{i + 1}</span>
              <h3 style={{ fontSize: 21, maxWidth: "12ch" }}>{t}</h3>
              <p className="muted" style={{ fontSize: 14.5, marginBottom: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="l-section">
        <div className="eyebrow">Built for the trade</div>
        <h2 style={{ margin: "8px 0 28px", maxWidth: "20ch" }}>Not a chatbot. A procurement clerk who never sleeps.</h2>
        <div className="grid g3">
          {FEATURES.map(([t, d, icon]) => {
            const I = Icon[icon];
            return (
              <div key={t} className="card card-pad">
                <div style={{ color: "var(--madder)", marginBottom: 10 }}>
                  <I size={22} />
                </div>
                <h3 style={{ fontSize: 19 }}>{t}</h3>
                <p className="muted" style={{ fontSize: 14.5, marginBottom: 0 }}>{d}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="l-section">
        <div className="grid g3">
          {[
            ["Textile traders", "Answer every rate enquiry in the market before the shop next door does — with the right margin."],
            ["Garment manufacturers", "Turn buyer tech-packs and POs into fabric, yarn and trim procurement in one pass."],
            ["Wholesalers", "Keep 50+ mills’ weekly rate lists in one place and always quote from today’s price."],
          ].map(([t, d]) => (
            <div key={t} className="card card-pad" style={{ background: "var(--card-2)" }}>
              <div className="eyebrow">For</div>
              <h3 style={{ fontSize: 24, margin: "4px 0 6px" }}>{t}</h3>
              <p className="muted" style={{ margin: 0 }}>{d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="l-section" id="pricing">
        <div className="eyebrow">Pricing</div>
        <h2 style={{ margin: "8px 0 8px" }}>One monthly subscription per business.</h2>
        <p className="muted" style={{ margin: "0 0 28px" }}>No per-seat surprises. Pay for the orders you read. GST extra.</p>
        <div className="grid g3">
          {PLANS.map((p) => (
            <div key={p.id} className={`card price-card${p.highlight ? " hl" : ""}`}>
              <b style={{ fontSize: 20 }}>{p.name}</b>
              <span className="muted" style={{ fontSize: 14 }}>{p.blurb}</span>
              <div>
                <span className="price-big">₹{p.priceMonthly.toLocaleString("en-IN")}</span>
                <span className="faint"> /month</span>
              </div>
              <ul>
                {p.features.map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
              <Link href="/desk" className={`btn ${p.highlight ? "btn-primary" : ""}`} style={{ marginTop: "auto" }}>
                Start 14-day trial
              </Link>
            </div>
          ))}
        </div>
      </section>

      <div className="weave-banner" style={{ height: 14 }} />
      <footer className="footer">
        <span>Taana — the warp thread every order runs on.</span>
        <span>Made for Surat, Tiruppur, Ludhiana, Bhiwandi & every market in between.</span>
      </footer>
    </div>
  );
}
