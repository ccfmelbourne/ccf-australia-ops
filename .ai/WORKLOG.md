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

## Slice 2: Requester Email Notifications (2026-08-28)
Built on branch `feature/finance-v1-requester-notifications`, not yet merged. Fills the last
unbuilt item from Finance V1's confirmed scope list (`.ai/PROJECT.md`): email the requester
whenever Finance changes their request's status.

- Scope decided with the project's decision-maker before building: spec 0001's literal
  confirmed example ("Finance is notified... ready for processing") isn't reachable yet, since
  the approval-routing code that would trigger it doesn't exist — slice 1 starts from an
  already-approved, seeded request. Built the buildable half instead: notify the **requester**
  when Finance transitions status (Needs Clarification/Processing/Processed/Rejected-Returned),
  which slice 1's existing `transitionRequestStatus` already supports.
- Email provider decided with the decision-maker: Resend (`platform/src/lib/notifications.ts`),
  clarified that it only affects the sending side — recipients (Finance's Gmail, a requester's
  own address, anything) receive mail in their normal inbox exactly as before; Resend just needs
  a verified "from" domain CCF controls.
- `buildStatusChangeEmail` kept as a pure, directly-testable function (mirrors the
  `status-transitions.ts` pattern) separate from `sendStatusChangeEmail`'s actual Resend call;
  added `notifications.test.ts`. Promoted the shared status-label map to
  `FINANCE_STATUS_LABELS` in `status-transitions.ts` so `StatusBadge` and the email use the same
  wording.
- `transitionRequestStatus` (`finance-data.ts`) now returns the requester's email/name and the
  formatted voucher/amount so `actions.ts` can send the notification after a successful
  transition. Per ADR 0001 (email is a notification channel only, never authoritative), a
  send failure is caught and logged, not allowed to fail or roll back the status transition it's
  reporting on.
- Verified: `tsc --noEmit` clean, `node --test` 9/9 passing (2 new), `next lint` clean, `next
  build` succeeds without `RESEND_API_KEY`/`EMAIL_FROM_ADDRESS` set (confirms the build never
  needs them, since the Finance routes are `force-dynamic`), and — against the real
  Vercel-provisioned Postgres, with Resend intentionally left unconfigured — a live headless
  browser run confirmed the status transition still succeeds and persists (200 OK, badge updated
  after reload) while the console logged the expected "Failed to send status change email:
  RESEND_API_KEY is not set" error, proving the resilience behavior works as designed.
- Added `RESEND_API_KEY` / `EMAIL_FROM_ADDRESS` to `platform/.env.example`. Real Resend
  configuration (domain verification, API key) is still needed before requesters will actually
  receive these emails — not yet done.
- Follow-up UX polish on the same request detail page, from review feedback: a "Back to queue"
  button (styled button, real `Link` underneath so right-click/open-in-new-tab/prefetch still
  work); a spinner alongside "Submitting…"; the status form's button renamed "Update status" ->
  "Submit"; the queue table's "Requester" column renamed "Requested by"; and the post-submit
  state fixed to track the *actual new status* (not the stale `currentStatus` prop) so
  submitting into a terminal status (Processed/Rejected-Returned) shows the same "no further
  action needed" message used on initial load, instead of a disabled form implying more actions
  remain — and removed the inline "Status updated" confirmation entirely once the toast covered
  the same information, to avoid showing both.

## Slice 3: Receipt Storage Infrastructure (2026-08-28)
Not yet on its own branch/PR at time of writing. Reusable Cloudflare R2 (S3-compatible) upload/
download plumbing (`platform/src/lib/receipt-storage.ts`), built ahead of deciding which
higher-level feature (Finance attaching a receipt during Needs Clarification, vs. a full
request-creation flow) will actually call it — both would need the same plumbing underneath, so
this doesn't lock in that decision yet.

- `uploadReceipt` / `getReceiptDownloadUrl` via `@aws-sdk/client-s3` +
  `@aws-sdk/s3-request-presigner`, pointed at R2's S3-compatible endpoint — matches ADR 0002's
  `oc` (Oceania) location hint decision. Receipts are not public; viewing uses a short-lived
  signed URL.
- `assertValidReceiptFile` (size/content-type sanity: 10MB max, PDF/JPEG/PNG/HEIC only) and
  `buildReceiptStorageKey` kept pure/directly-testable, separate from the actual R2 calls — same
  split used in `notifications.ts`. Virus/malware scanning remains a genuinely open question
  (spec 0002), not addressed here.
- Added `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` to
  `platform/.env.example`.
- Verified: `tsc --noEmit` clean, `node --test` 15/15 passing (6 new), `next lint` clean, `next
  build` succeeds with no R2 env vars set (this module isn't imported/wired into any route yet,
  so it's inert until a caller exists).
- **Update (2026-08-28, later same day):** Cloudflare R2 bucket (`oc` Oceania) and API token
  provisioned. Live-verified against the real bucket: uploaded a test file via `uploadReceipt`,
  generated a signed URL via `getReceiptDownloadUrl`, fetched it, and confirmed the round-tripped
  content and `Content-Type` matched exactly (`200 OK`). Test object deleted afterward. R2
  storage infrastructure is now fully verified end-to-end, still not wired into any route/UI.

## Open items
None currently tracked as blocking.

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
