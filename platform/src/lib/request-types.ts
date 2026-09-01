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

// Started as the Track A pilot's 10 values, mirrored 1:1
// (mvp/reimbursement-voucher/js/approval-rules.js MINISTRY_TYPE_TO_APPROVAL_GROUP).
// Split COMMS_MEDIA_DGM into COMMS_MEDIA + DGM (2026-08-31): confirmed each
// ministry type is assigned its own named approver individually, and these
// two have different people (Dexter Santiago vs. Moriz Manlangit).
// Split EVENTS_HOST into EVENTS_RETREAT + HOST (2026-09-01): same
// reasoning -- Eland Afuang vs. Lawrence Hernando. Also fixed the
// OCEANA_REGIONAL -> OCEANIA_REGIONAL spelling.
export const MINISTRY_TYPES = [
  "ADMIN",
  "EXALT_LIVE_PROD",
  "FINANCE",
  "NXTGEN",
  "PASTORAL_CARE",
  "B1G",
  "ELEVATE",
  "EVENTS_RETREAT",
  "HOST",
  "COMMS_MEDIA",
  "DGM",
  "OCEANIA_REGIONAL",
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
  EVENTS_RETREAT: "Events / Retreat",
  HOST: "Host",
  COMMS_MEDIA: "Comms / Media",
  DGM: "DGM",
  OCEANIA_REGIONAL: "Oceania Regional",
};

// Mirrors the RequestStatus enum (schema.prisma). Only DRAFT, IN_APPROVAL,
// APPROVED, and REJECTED_RETURNED are reachable through the app today
// (Finance-side transitions no longer exist -- Finance retired from the
// app entirely); the rest are included for completeness so the requests
// table never shows a raw enum value.
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
