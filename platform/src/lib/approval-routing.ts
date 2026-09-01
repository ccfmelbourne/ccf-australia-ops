// Pure, directly testable -- no network/DB calls. Which approver ROLES a
// request needs, per the confirmed tier rules (spec 0001, corrected
// 2026-09-02 after two rounds of walking the real business rule through
// with the decision-maker -- see COS_POOL below).

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

// COS1/COS2 aren't fixed named slots (COS1 always Ross, COS2 always Joel)
// -- they're claimable positions open to a shared, org-wide pool of
// exactly three people. Whoever of the three acts first on a given
// request's COS1 or COS2 row claims it (approval-data.ts's decideApproval
// sets approverUserId at decision time, not before); each needed slot must
// be claimed by a different person. A decline from whoever claims a slot
// still rejects the whole request, same as every other role -- there's no
// "try someone else" fallback. Corrected 2026-09-02 after an earlier,
// wrong fixed-slot-per-person model.
// Local/dev-testing-only identities (see src/app/api/dev/login/route.ts) --
// only actually routed real approvals when NODE_ENV !== "production", so
// the deployed app never treats DEV_TEST_APPROVER_EMAIL as a real pool
// member even though it shares the same database as local dev.
// approval-data.ts further scopes the dev approver identity to only ever
// act on DEV_TEST_REQUESTER_EMAIL's own requests, never a real person's --
// COS_POOL membership alone isn't request-scoped, so without that extra
// check the dev approver could otherwise claim a real pending approval on
// any tier-2+ request in the shared database.
export const DEV_TEST_APPROVER_EMAIL = "dev-approver@test.local";
export const DEV_TEST_REQUESTER_EMAIL = "dev-requester@test.local";

export const COS_POOL = [
  "rosscallado@gmail.com",
  "joel.jmj@gmail.com",
  "vamiebpinlac@gmail.com",
  ...(process.env.NODE_ENV === "production" ? [] : [DEV_TEST_APPROVER_EMAIL]),
] as const;

// Tier 4's Regional Director requirement can be satisfied two ways: his
// own direct approval, or the same COS1+COS2 baseline (already required)
// plus this specific person -- Ross Callado, by name, not "whichever pool
// member" -- explicitly confirming the request is within budget. See
// approval-data.ts's confirmRegionalDirectorOverride/isFullyApproved.
// When to actually invoke this (the decision-maker's guidance: only once
// Regional Director's been sitting on it a week or more) is Ross's own
// judgment call, not something the system tracks or enforces.
export const REGIONAL_DIRECTOR_OVERRIDE_CONFIRMER_EMAIL = "rosscallado@gmail.com";

// Ministry Overseer only applies to tiers 1-2; tier 3/4 requests skip
// straight to COS-level approval. 1 COS for tier 2, 2 for tier 3 and 4
// (confirmed 2026-09-02, correcting an earlier "Overseer always applies,
// 1/2/3 COS by tier" assumption that turned out wrong).
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
