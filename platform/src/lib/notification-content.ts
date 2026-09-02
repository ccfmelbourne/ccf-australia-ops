import { REQUEST_TYPE_LABELS, MINISTRY_TYPE_LABELS } from "./request-types.ts";
import type { ApprovedRequestDetail } from "@/lib/request-data";

// Pure and directly testable -- no network/DB/PDF-rendering imports (mirrors
// the pure/impure split elsewhere, e.g. parse-receipt-text.ts vs
// google-vision-extractor.ts). Deliberately short: the attached voucher PDF
// (voucher-pdf.tsx) is the official document and carries every detail,
// including bank details, which must never appear in the email body itself.
// Request type + ministry are the one exception -- quick-scan triage info
// (nothing sensitive) that lets Finance tell what a voucher's about without
// opening the PDF, unlike line items/bank details/approval specifics, which
// stay PDF-only.
export function buildApprovedRequestEmail(detail: ApprovedRequestDetail): {
  subject: string;
  text: string;
} {
  const receiptCount = detail.receipts.length;
  const receiptWord = receiptCount === 1 ? "receipt" : "receipts";
  // "No receipts were attached" reads as an actual notification to Finance;
  // "including 0 receipts" read like a debug/system message. Phrased as
  // "also attached" (not "including N receipts") to match how the PDF
  // itself is introduced first, then the receipts as a secondary fact.
  const receiptClause =
    receiptCount === 0
      ? "No receipts were attached."
      : `${receiptCount} ${receiptWord} ${receiptCount === 1 ? "is" : "are"} also attached.`;
  const category = `${REQUEST_TYPE_LABELS[detail.requestType]} — ${MINISTRY_TYPE_LABELS[detail.ministryType]}`;
  return {
    subject: `Reimbursement ${detail.voucherNo} — Approved`,
    text: `The attached voucher ${detail.voucherNo} (${category}) for ${detail.requesterName} ($${detail.totalAmount}) has been fully approved and is ready for processing. ${receiptClause}`,
  };
}
