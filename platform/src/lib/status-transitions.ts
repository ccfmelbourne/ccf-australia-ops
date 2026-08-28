// Pure logic, no DB/Next.js imports — mirrors the pattern already validated in
// mvp/reimbursement-voucher/js/approval-rules.js (repo root): keep routing/
// state-machine decisions in one small, directly-testable module.
//
// Scope note (slice 1): only the Finance-side transitions this vertical
// slice actually needs are modeled. Approval-workflow states (DRAFT,
// SUBMITTED, IN_APPROVAL) and the full "Request Changes -> back through
// approval" cycle from specs/0002-reimbursement-data-model-api.md are not
// reachable here yet — add them when a later slice builds that flow.

export type FinanceStatus =
  | "READY_FOR_PROCESSING"
  | "NEEDS_CLARIFICATION"
  | "PROCESSING"
  | "PROCESSED"
  | "REJECTED_RETURNED";

// Per specs/0001-reimbursement-approval-finance-workflow.md's confirmed
// statuses: Needs Clarification is for missing documentation only (pauses,
// no re-approval) and can resume from where it left off; Processed and
// Rejected/Returned are terminal for this slice.
const ALLOWED_TRANSITIONS: Record<FinanceStatus, readonly FinanceStatus[]> = {
  READY_FOR_PROCESSING: ["PROCESSING", "NEEDS_CLARIFICATION", "REJECTED_RETURNED"],
  PROCESSING: ["NEEDS_CLARIFICATION", "PROCESSED", "REJECTED_RETURNED"],
  NEEDS_CLARIFICATION: ["READY_FOR_PROCESSING", "PROCESSING", "REJECTED_RETURNED"],
  PROCESSED: [],
  REJECTED_RETURNED: [],
};

// Shared with StatusBadge (display) and the status-change email (notifications.ts) so both
// surfaces describe a status the same way.
export const FINANCE_STATUS_LABELS: Record<FinanceStatus, string> = {
  READY_FOR_PROCESSING: "Ready for Processing",
  NEEDS_CLARIFICATION: "Needs Clarification",
  PROCESSING: "Processing",
  PROCESSED: "Processed",
  REJECTED_RETURNED: "Rejected / Returned",
};

export function getAllowedNextStatuses(current: FinanceStatus): readonly FinanceStatus[] {
  return ALLOWED_TRANSITIONS[current];
}

export function isValidTransition(from: FinanceStatus, to: FinanceStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function assertValidTransition(from: FinanceStatus, to: FinanceStatus): void {
  if (!isValidTransition(from, to)) {
    throw new Error(
      `Invalid Finance status transition: ${from} -> ${to}. Allowed from ${from}: ${
        ALLOWED_TRANSITIONS[from].join(", ") || "(none — terminal status)"
      }`,
    );
  }
}
