import type { ApprovedRequestDetail } from "@/lib/request-data";

// Pure and directly testable -- no network/DB/PDF-rendering imports (mirrors
// the pure/impure split elsewhere, e.g. parse-receipt-text.ts vs
// google-vision-extractor.ts). Deliberately short: the attached voucher PDF
// (voucher-pdf.tsx) is the official document and carries every detail,
// including bank details, which must never appear in the email body itself.
export function buildApprovedRequestEmail(detail: ApprovedRequestDetail): {
  subject: string;
  text: string;
} {
  const receiptWord = detail.receipts.length === 1 ? "receipt" : "receipts";
  return {
    subject: `Reimbursement ${detail.voucherNo} approved — $${detail.totalAmount}`,
    text: `The attached voucher for ${detail.voucherNo} (${detail.requesterName}, $${detail.totalAmount}) has been fully approved, including ${detail.receipts.length} ${receiptWord}.`,
  };
}
