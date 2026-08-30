// Human-readable labels for the RequestType/MinistryType enums
// (schema.prisma). No DB/Next.js imports -- pure, directly testable.

export const REQUEST_TYPES = [
  "CASH_ADVANCE",
  "REIMBURSEMENT",
  "LIQUIDATION_OF_CASH_ADVANCE",
  "BENEVOLENCE",
  "PAYMENT_TO_SUPPLIER",
  "STATE_INTERNATIONAL_TRANSFER",
] as const;
export type RequestTypeValue = (typeof REQUEST_TYPES)[number];

export const REQUEST_TYPE_LABELS: Record<RequestTypeValue, string> = {
  CASH_ADVANCE: "Cash Advance",
  REIMBURSEMENT: "Reimbursement",
  LIQUIDATION_OF_CASH_ADVANCE: "Liquidation of Cash Advance",
  BENEVOLENCE: "Benevolence",
  PAYMENT_TO_SUPPLIER: "Payment to Supplier",
  STATE_INTERNATIONAL_TRANSFER: "State/International Transfer",
};

// Mirrors the 10 "Ministry Type" values from the Track A pilot
// (mvp/reimbursement-voucher/js/approval-rules.js MINISTRY_TYPE_TO_APPROVAL_GROUP),
// same enum already used in schema.prisma.
export const MINISTRY_TYPES = [
  "ADMIN",
  "EXALT_LIVE_PROD",
  "FINANCE",
  "NXTGEN",
  "PASTORAL_CARE",
  "B1G",
  "ELEVATE",
  "EVENTS_HOST",
  "COMMS_MEDIA_DGM",
  "OCEANA_REGIONAL",
] as const;
export type MinistryTypeValue = (typeof MINISTRY_TYPES)[number];

export const MINISTRY_TYPE_LABELS: Record<MinistryTypeValue, string> = {
  ADMIN: "Admin",
  EXALT_LIVE_PROD: "Exalt / Live Prod",
  FINANCE: "Finance",
  NXTGEN: "NxtGen",
  PASTORAL_CARE: "Pastoral Care",
  B1G: "B1G",
  ELEVATE: "Elevate",
  EVENTS_HOST: "Events / Host",
  COMMS_MEDIA_DGM: "Comms / Media / DGM",
  OCEANA_REGIONAL: "Oceana Regional",
};

// Mirrors the RequestStatus enum (schema.prisma). Only DRAFT and
// IN_APPROVAL are reachable through the app today (no approver UI or
// Finance-side transitions exist yet); the rest are included for
// completeness so the requests table never shows a raw enum value.
export const REQUEST_STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Submitted",
  IN_APPROVAL: "In Approval",
  APPROVED: "Approved",
  READY_FOR_PROCESSING: "Ready for Processing",
  NEEDS_CLARIFICATION: "Needs Clarification",
  PROCESSING: "Processing",
  PROCESSED: "Processed",
  REJECTED_RETURNED: "Rejected / Returned",
};
