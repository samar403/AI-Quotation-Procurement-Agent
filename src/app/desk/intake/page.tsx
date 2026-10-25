import { Suspense } from "react";
import { Intake } from "@/components/Intake";

export const metadata = { title: "New order · Taana" };

export default function IntakePage() {
  return (
    <>
      <div className="page-head">
        <div>
          <div className="eyebrow">Intake</div>
          <h1>Drop in a buyer&rsquo;s order.</h1>
          <p>
            Paste a WhatsApp message, forward an email, upload a PDF PO or a photo of a handwritten list. The agent reads it, matches every line to your mills,
            and drafts a margin-safe quotation for approval.
          </p>
        </div>
      </div>
      <Suspense>
        <Intake />
      </Suspense>
    </>
  );
}
