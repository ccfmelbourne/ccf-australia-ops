import { REQUEST_TYPE_LABELS, MINISTRY_TYPE_LABELS } from "./request-types.ts";
import type { ApprovedRequestDetail } from "@/lib/request-data";
import type { RequestTypeValue, MinistryTypeValue } from "@/lib/request-types";

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

export interface StaleDraftReminderDetail {
  voucherNo: string;
  requestType: RequestTypeValue;
  ministryType: MinistryTypeValue;
  totalAmount: string;
  daysStale: 3 | 7;
}

// Sent to the requester (unlike buildApprovedRequestEmail, which goes to
// Finance) about a non-empty draft that's gone quiet -- see
// request-data.ts's sendStaleDraftReminders for the reminder schedule.
// No login link: per ADR 0001 email is a notification only, so signing
// in and finding it on "My requests" is the expected path.
export function buildStaleDraftReminderEmail(detail: StaleDraftReminderDetail): {
  subject: string;
  text: string;
} {
  const category = `${REQUEST_TYPE_LABELS[detail.requestType]} — ${MINISTRY_TYPE_LABELS[detail.ministryType]}`;
  const sinceClause = detail.daysStale === 7 ? "over a week" : "a few days";
  return {
    subject: `Reminder: your draft ${detail.voucherNo} is still waiting`,
    text: `Your draft voucher ${detail.voucherNo} (${category}, $${detail.totalAmount}) hasn't been touched in ${sinceClause}. Sign back in to continue and submit it, or delete it if you no longer need it.`,
  };
}

export interface ApprovalNotificationDetail {
  voucherNo: string;
  requestType: RequestTypeValue;
  ministryType: MinistryTypeValue;
  totalAmount: string;
  requesterName: string;
  roleLabel: string;
}

// Sent the moment a role becomes actionable (request-data.ts's
// submitRequest). roleLabel names the role being asked to decide (e.g.
// "COS 1"), since a claimable COS slot goes to the whole pool at once,
// not one specific person.
export function buildNewApprovalNotificationEmail(detail: ApprovalNotificationDetail): {
  subject: string;
  text: string;
} {
  const category = `${REQUEST_TYPE_LABELS[detail.requestType]} — ${MINISTRY_TYPE_LABELS[detail.ministryType]}`;
  return {
    subject: `Approval needed: ${detail.voucherNo}`,
    text: `${detail.requesterName} submitted a ${category} request (${detail.voucherNo}, $${detail.totalAmount}) that needs your review as ${detail.roleLabel}. Sign in to approve or decline it.`,
  };
}

export interface PendingApprovalReminderDetail extends ApprovalNotificationDetail {
  daysPending: 2 | 5 | 7;
}

// The follow-up to buildNewApprovalNotificationEmail, for a role still
// PENDING 2/5/7 days later -- see approval-data.ts's
// sendPendingApprovalReminders.
export function buildPendingApprovalReminderEmail(detail: PendingApprovalReminderDetail): {
  subject: string;
  text: string;
} {
  const category = `${REQUEST_TYPE_LABELS[detail.requestType]} — ${MINISTRY_TYPE_LABELS[detail.ministryType]}`;
  return {
    subject: `Reminder: ${detail.voucherNo} is still waiting on your approval`,
    text: `${detail.requesterName}'s ${category} request (${detail.voucherNo}, $${detail.totalAmount}) has been waiting on your review as ${detail.roleLabel} for ${detail.daysPending} days. Sign in to approve or decline it.`,
  };
}
