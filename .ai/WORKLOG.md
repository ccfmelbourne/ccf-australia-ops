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

## Slice 1: Finance Queue → Request Detail → Mark Status (2026-08-27)
Built on branch `feature/finance-v1-slice-1`, not yet merged. Approved Reimbursement (seeded) →
Finance Queue → accountant opens request → views line items/receipts/approval history → marks
next status → audit event recorded, per the vertical slice the project's decision-maker
specified. Scaffolded under `platform/` (Next.js 16 / React 19 / TypeScript / Tailwind / Storybook /
Zod / Prisma 7, per ADR 0002).

- Schema (`platform/prisma/schema.prisma`): slice-1 subset of spec 0002 — User, ReimbursementRequest,
  LineItem, Receipt, RequiredApproval, AuditLogEntry. `BankDetails` and
  `RegionalDirectorOverride`/`OverrideApproval` intentionally deferred (not touched by this
  slice's UI) — spec 0002 to be updated when a later slice needs them.
- Status state machine (`platform/src/lib/status-transitions.ts` + tests): READY_FOR_PROCESSING ->
  PROCESSING/NEEDS_CLARIFICATION/REJECTED_RETURNED, PROCESSING -> PROCESSED/etc., mirroring the
  Needs-Clarification-vs-re-approval distinction Finance/leadership confirmed in spec 0001.
- Finance login: minimal, single env-configured accountant identity (signed session cookie),
  per explicit direction to keep slice-1 auth minimal — see `platform/src/lib/finance-auth.ts` and
  `.ai/PROJECT.md`.
- 6 Storybook stories across 5 components (StatusBadge, QueueList, ApprovalHistoryList,
  StatusTransitionForm, RequestDetailView) — all render with static fixture data, no DB needed
  to run Storybook.
- Verified: `tsc --noEmit` clean, `node --test` 7/7 passing, `next lint` clean, `next build`
  succeeds, `storybook build` succeeds, and — against a real Vercel-provisioned Postgres
  (Neon, Sydney/`ap-southeast-2`, resource name `ccf-finance-db`) — the full slice verified live
  with a headless browser: login → session → queue shows seeded voucher → detail page shows
  line items/receipts/approval history → status transition (Ready for Processing → Processing)
  persists across a fresh reload → `AuditLogEntry` row confirmed created with correct actor and
  from/to detail.
- Notable corrections made while building (see PR/commit for detail): avoided "Prisma Composer"
  (Prisma's own competing cloud-hosting product, which `prisma init` now defaults toward) in
  favor of traditional Prisma ORM against our own Postgres, matching ADR 0002's actual Vercel
  decision; Next.js 16 renamed Middleware to Proxy (`src/proxy.ts`, not `middleware.ts`); fixed
  a `platform/.gitignore` `.env*` rule that was accidentally also excluding `.env.example`; added
  `tsx` as a dev dependency to run standalone scripts (seed) outside Next's bundler, since the
  generated Prisma client's bundler-style imports don't resolve under plain `node`.
- Not yet done: Jira epic/stories (no Jira integration available yet — pending the
  decision-maker adding one), merging this branch.

## Open items
- TODO: Validate spec 0002's data model against a real implementation attempt; resolve its open
  questions (role/assignment modeling, multi-group membership, receipt upload constraints).
  (In review — see PR #4.)

## Decided
- Track A pilot's approval logic will not be updated to match the confirmed Regional
  Director/COS-override rule — the pilot stays as-is (Oceana-only rule) for the remainder of
  its test window. Focus going forward is on Track B.
- Added an Actions CI workflow for `platform/` (type-check, lint, test, build) once Track B had
  application code on `main` to test — see PR #3. Along the way, fixed the Vercel project's
  Root Directory (stale `mvp/reimbursement-voucher` path from the old pilot), Framework Preset
  (was "Other", now Next.js), and added a `postinstall: prisma generate` script so both CI and
  Vercel generate the Prisma client automatically.
- Cloudflare R2's data residency question (ADR 0002) is resolved: confirmed with the
  decision-maker that CCF's requirement is a latency/locality preference, not a hard compliance
  guarantee, so R2 with the `oc` (Oceania) location hint stands as the storage choice. Amazon S3
  in `ap-southeast-2` remains the fallback if that ever changes — see ADR 0002's "Data residency"
  note for the technical reasoning.
