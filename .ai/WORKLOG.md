# Engineering Worklog

## Purpose
Capture key decisions, progress, and open items for the repository foundation.

## Sections
- `Notes` — working context and discoveries.
- `Decisions` — approved repository-level decisions.
- `Open items` — TODO items and unresolved decisions.

## Notes
- Foundation phase (no application code) through 2026-08-27, Finance domain only. See
  "Phase Transition" below and `.ai/PROJECT.md`.
- Documentation should be brief and cross-referenced.

## Phase Transition (2026-08-27)
- Foundation phase complete for the Finance domain; Finance V1 implementation begins now. Other
  future domains remain foundation-only until their own discovery/architecture work is done —
  that discovery does **not** block Finance implementation.
- Spec 0002 is the working baseline data model; update it in place (with a note of what changed
  and why) when implementation reveals a legitimate gap, rather than treating it as final.
- No Finance capability beyond spec 0001's confirmed V1 scope gets built without being flagged
  for approval first — see `.ai/PROJECT.md`'s explicit in-scope/not-yet-in-scope lists.
- Implementation proceeds as small vertical slices (Storybook + tests per relevant slice), not
  all screens at once. First slice, per direction from the project's decision-maker: Approved
  Reimbursement → Finance Queue → Accountant opens request → view reimbursement + receipts +
  approval history → mark next status → audit event recorded. This intentionally starts on the
  Finance side only, assuming an already-approved reimbursement exists (seeded test data), not
  building the full request-creation-through-approval flow first.
- Full detail: `.ai/PROJECT.md` → "Phase Transition: Foundation → Finance V1 Implementation."

## Decisions
- Repository structure includes `.ai`, `docs/`, `adr/`, `specs/`, and `.github/`.
- AI guidance and project charter are stored under `.ai/`.
- README functions as a navigation hub with links to core docs.
- ADR 0001: the reimbursement application (not email/PDF) is the system of record for
  reimbursements and their approval history; email is a notification channel only. See
  `adr/0001-reimbursement-system-of-record.md`.
- Spec 0001: V1 scope boundary for the reimbursement request → approval → Finance queue
  workflow, explicitly excluding Xero/bank integration for V1. See
  `specs/0001-reimbursement-approval-finance-workflow.md`. Confirmed with Finance/leadership on
  2026-08-27, including Finance statuses, the Needs Clarification vs. re-approval distinction,
  email as primary notification channel, and a Regional Director/COS-override rule for >$5,000
  requests (Ross Callado, Joel Jerez, Vamie Pinlac can unanimously override Regional Director
  approval, but only if the request is within budget).
- ADR 0002: platform architecture is a modular monolith on Next.js, TypeScript, Tailwind,
  Storybook, Zod, Prisma, and PostgreSQL, with domain-scoped internal modules (Finance first).
  Hosting is Vercel for V1 (Next.js-native, low ops overhead for a volunteer-maintained system;
  avoids Vercel-specific lock-in so AWS migration stays possible later if ever justified).
  Receipt/document storage is Cloudflare R2 (S3-compatible), with Amazon S3 as the named
  fallback. See `adr/0002-platform-architecture.md`. Status: **Accepted** (2026-08-27) —
  confirmed directly with the project's decision-maker; no separate engineering team exists to
  loop in.
- `.github/` governance scaffolding added: PR template, a domain-proposal issue template, and a
  bug-report issue template. No CI workflow yet — no application code exists on `main` to test.
- `docs/product/README.md` and `docs/development/README.md` filled in with real content
  (Finance domain V1 summary; stack, branching, commit, and testing conventions).
- Spec 0002: illustrative Prisma-flavored data model and API/action contract for the Finance
  domain (User, ReimbursementRequest, LineItem, Receipt, BankDetails, RequiredApproval,
  RegionalDirectorOverride/OverrideApproval, AuditLogEntry). See
  `specs/0002-reimbursement-data-model-api.md`. Draft — flags the tier-4 approval OR-branching
  as needing its own model, carries forward the pilot's sensitive-data (bank details) and
  voucher-numbering (no `Math.random()`) findings, and is not yet validated against a real
  implementation attempt.

## Open items
- TODO: Add an Actions CI workflow once Track B has application code to test on `main`.
- TODO: Verify CCF's data residency/privacy requirements against Cloudflare R2's actual
  available region(s) before the storage choice in ADR 0002 is fully locked in. If Australia-only
  residency is required and R2 can't guarantee it, switch to Amazon S3 in an Australian region.
- TODO: Validate spec 0002's data model against a real implementation attempt; resolve its open
  questions (role/assignment modeling, multi-group membership, receipt upload constraints).

## Decided
- Track A pilot's approval logic will not be updated to match the confirmed Regional
  Director/COS-override rule — the pilot stays as-is (Oceana-only rule) for the remainder of
  its test window. Focus going forward is on Track B.
