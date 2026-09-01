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

// Mirrors the RequestStatus enum (schema.prisma) -- five values, all of
// them reachable: a request goes DRAFT -> IN_APPROVAL, then either
// terminates at APPROVED, or bounces to NEEDS_CLARIFICATION/
// REJECTED_RETURNED for the requester to fix and resubmit. The old
// Finance-processing statuses (SUBMITTED/READY_FOR_PROCESSING/PROCESSING/
// PROCESSED) were removed from the schema entirely 2026-09-02 -- Finance
// retired from the app, so nothing ever produced them.
//
// Single source of truth for status wording/visual language, consumed by
// RequestStatusBadge.tsx (components/) for the colored badge everywhere
// the UI shows a request's status (dashboard, request list, request
// detail, approval screen) -- icon/tone included here rather than
// duplicated in the component, so there's exactly one place that defines
// what each status means. "tone" is a semantic bucket, not a literal
// color, so the badge component owns the actual Tailwind classes.
export type RequestStatusTone = "neutral" | "active" | "warning" | "success" | "danger";

export interface RequestStatusMeta {
  label: string;
  icon: "○" | "●" | "✓" | "×";
  tone: RequestStatusTone;
}

export const REQUEST_STATUS_META: Record<string, RequestStatusMeta> = {
  DRAFT: { label: "Draft", icon: "○", tone: "neutral" },
  IN_APPROVAL: { label: "Awaiting approval", icon: "●", tone: "active" },
  NEEDS_CLARIFICATION: { label: "Needs changes", icon: "●", tone: "warning" },
  APPROVED: { label: "Approved", icon: "✓", tone: "success" },
  REJECTED_RETURNED: { label: "Rejected", icon: "×", tone: "danger" },
};

// Plain-text label only, derived from the same source above -- for any
// non-visual context (e.g. a future notification's plain-text body) that
// needs consistent wording without pulling in a UI component.
export const REQUEST_STATUS_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(REQUEST_STATUS_META).map(([status, meta]) => [status, meta.label]),
);
