// Pure, directly testable -- no network/DB calls. Which approver ROLES a
// request needs, per the confirmed tier rules (spec 0001). Deliberately
// does not resolve WHO fills each role (ministry-group-specific named
// approvers) -- that's a separate, later concern (the approver-facing UI
// slice), and the pilot's own reference data has real gaps there (no
// emails, and several role slots have no named person at all), so
// RequiredApproval rows are created with approverUserId left null.

import type { MinistryTypeValue } from "@/lib/request-types";

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

// Oceania Regional's Ministry Overseer (Ptr. Ryan Escobar) is displayed as
// "Regional Director" there rather than "Ministry Overseer" -- confirmed
// with the decision-maker (2026-09-01), who wanted one consistent title
// for him rather than two ("Regional Coordinator" for the ministry-level
// role vs. "Regional Director" for the org-wide tier-4 role). Functionally
// he's still the MINISTRY_OVERSEER role (same approval semantics, same
// tier rules); only the display label differs for this one ministry, so
// this stays a label override rather than a new ApproverRole.
export function getApproverRoleLabel(role: string, ministryType: MinistryTypeValue): string {
  if (role === "MINISTRY_OVERSEER" && ministryType === "OCEANIA_REGIONAL") {
    return "Regional Director";
  }
  return APPROVER_ROLE_LABELS[role as ApproverRoleValue] ?? role;
}

export type ApprovalTier = 1 | 2 | 3 | 4;

// Approval Limits: <=$500 / >$500-2,000 / >$2,000-5,000 / >$5,000.
export function getTier(totalAmount: number): ApprovalTier {
  if (totalAmount <= 500) return 1;
  if (totalAmount <= 2000) return 2;
  if (totalAmount <= 5000) return 3;
  return 4;
}

// The three fixed committee members for the tier-4 Regional Director
// override (specs/0001, confirmed with leadership) -- a specific named
// committee, not "any 3 COS": confirmed against the live ApproverAssignment
// data that Vamie Pinlac isn't even the currently-assigned COS1/Overseer
// for any ministry today, so this can't be resolved through
// ApproverAssignment the way other roles are. Hardcoded by email (matching
// prisma/seed.ts's NAMED_USERS, where these three are seeded regardless of
// their current per-ministry assignment) and resolved to User rows by
// whoever calls requestOverride/overrideApprove (approval-data.ts).
export const REGIONAL_DIRECTOR_OVERRIDE_COMMITTEE_EMAILS = [
  "rosscallado@gmail.com",
  "joel.jmj@gmail.com",
  "vamiebpinlac@gmail.com",
] as const;

// The confirmed rule -- not the pilot's outdated one, which gated the
// Regional Director requirement to the Oceana ministry group only. Here
// tier 4 always requires the Regional Director, for every group; the
// alternative unanimous-3-named-COS override
// (REGIONAL_DIRECTOR_OVERRIDE_COMMITTEE_EMAILS above) is handled separately
// by approval-data.ts's requestOverride/overrideApprove, not by this
// function -- a tier-4 request's RequiredApproval rows always include
// REGIONAL_DIRECTOR regardless of whether an override is ever pursued.
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
