// Pure, directly testable -- no network/DB calls. Which approver ROLES a
// request needs, per the confirmed tier rules (spec 0001). Deliberately
// does not resolve WHO fills each role (ministry-group-specific named
// approvers) -- that's a separate, later concern (the approver-facing UI
// slice), and the pilot's own reference data has real gaps there (no
// emails, and several role slots have no named person at all), so
// RequiredApproval rows are created with approverUserId left null.

export const APPROVER_ROLES = [
  "MINISTRY_OVERSEER",
  "COS1",
  "COS2",
  "FINANCE_OVERSEER",
  "REGIONAL_DIRECTOR",
] as const;
export type ApproverRoleValue = (typeof APPROVER_ROLES)[number];

export const APPROVER_ROLE_LABELS: Record<ApproverRoleValue, string> = {
  MINISTRY_OVERSEER: "Ministry Overseer",
  COS1: "COS 1",
  COS2: "COS 2",
  FINANCE_OVERSEER: "Finance Overseer",
  REGIONAL_DIRECTOR: "Regional Director",
};

export type ApprovalTier = 1 | 2 | 3 | 4;

// Approval Limits: <=$500 / >$500-2,000 / >$2,000-5,000 / >$5,000.
export function getTier(totalAmount: number): ApprovalTier {
  if (totalAmount <= 500) return 1;
  if (totalAmount <= 2000) return 2;
  if (totalAmount <= 5000) return 3;
  return 4;
}

// The confirmed rule -- not the pilot's outdated one, which gated the
// Regional Director requirement to the Oceana ministry group only. Here
// tier 4 always requires the Regional Director, for every group; the
// alternative unanimous-3-named-COS override path is a separate, later
// roadmap item (RegionalDirectorOverride/OverrideApproval), not decided by
// this function.
export function getRequiredApproverRoles(tier: ApprovalTier): ApproverRoleValue[] {
  switch (tier) {
    case 1:
      return ["MINISTRY_OVERSEER"];
    case 2:
      return ["MINISTRY_OVERSEER", "COS1"];
    case 3:
      return ["COS1", "COS2", "FINANCE_OVERSEER"];
    case 4:
      return ["COS1", "COS2", "FINANCE_OVERSEER", "REGIONAL_DIRECTOR"];
  }
}
