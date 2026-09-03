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

// COS1/COS2 are claimable positions open to any of COS_POOL below, not a
// single pre-assigned person -- their RequiredApproval rows carry
// approverUserId: null until claimed at decision time.
export const CLAIMABLE_ROLES: ReadonlySet<ApproverRoleValue> = new Set(["COS1", "COS2"]);

export const APPROVER_ROLE_LABELS: Record<ApproverRoleValue, string> = {
  MINISTRY_OVERSEER: "Ministry Overseer",
  COS1: "COS 1",
  COS2: "COS 2",
  FINANCE_OVERSEER: "Finance Overseer",
  REGIONAL_DIRECTOR: "Regional Director",
};

// Oceania Regional's Ministry Overseer displays as "Regional Director"
// instead of "Ministry Overseer" -- one consistent title rather than two,
// per the decision-maker. Functionally still MINISTRY_OVERSEER (same
// approval semantics/tier rules); only the label differs, so this stays
// a label override rather than a new ApproverRole.
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

// COS1/COS2 aren't fixed named slots -- they're claimable positions open
// to a shared pool of real people, configured via COS_POOL_EMAILS rather
// than hardcoded here. Whoever claims a slot first owns it (decideApproval
// sets approverUserId at decision time); a decline still rejects the
// whole request, same as every other role.

// Local/dev-testing-only identities -- only routed real approvals when
// NODE_ENV !== "production", so production never treats
// DEV_TEST_APPROVER_EMAIL as a real pool member even though it shares the
// same database as local dev. approval-data.ts further scopes the dev
// approver to only act on DEV_TEST_REQUESTER_EMAIL's own requests, since
// COS_POOL membership alone isn't request-scoped.
export const DEV_TEST_APPROVER_EMAIL = "dev-approver@test.local";
export const DEV_TEST_REQUESTER_EMAIL = "dev-requester@test.local";

// COS_POOL_EMAILS: comma-separated real approver emails (see .env.example).
const configuredCosPoolEmails = (process.env.COS_POOL_EMAILS ?? "")
  .split(",")
  .map((email) => email.trim())
  .filter(Boolean);

export const COS_POOL = [
  ...configuredCosPoolEmails,
  ...(process.env.NODE_ENV === "production" ? [] : [DEV_TEST_APPROVER_EMAIL]),
];

// Tier 4's Regional Director requirement can be satisfied two ways: a
// direct approval, or the COS1+COS2 baseline plus one specific,
// designated person (configured via
// REGIONAL_DIRECTOR_OVERRIDE_CONFIRMER_EMAIL) explicitly confirming the
// request is within budget (see approval-data.ts's
// confirmRegionalDirectorOverride). When to invoke this -- per the
// decision-maker, only once Regional Director's been pending a week or
// more -- is that person's own judgment call, not system-enforced.
export const REGIONAL_DIRECTOR_OVERRIDE_CONFIRMER_EMAIL =
  process.env.REGIONAL_DIRECTOR_OVERRIDE_CONFIRMER_EMAIL ?? "";

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
