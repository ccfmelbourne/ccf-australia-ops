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
- **Not yet verified against a real R2 bucket** — Cloudflare R2 access/API token creation was
  still in progress with the decision-maker at time of writing. Live verification (an actual
  upload + signed-URL fetch round-trip) is a follow-up once credentials exist.

## Phase Transition: Finance V1 → Request Creation + Approval Routing (2026-08-28)
The decision-maker explicitly approved expanding beyond Finance V1's original charter boundary
(which was Finance-office-only, starting from an already-approved request) into building the
front half of the workflow: request creation and approval routing. A full slice roadmap was
planned (see the plan file referenced in this session) before any code was written, per the
charter's incremental-vertical-slice discipline. Roadmap: (1) Google sign-in, (2) create-DRAFT
request + line items, (3) receipt upload wiring, (4) bank details, (5) my-requests list, (6)
approval-routing logic module, (7) submit action, (8) approver UI + approve/reject, (9) tier-4
override branch, (10) Request Changes/re-approval cycle. Only (1) is built so far — see below.

## Slice 4: Google Sign-In (2026-08-28)
Requesters/approvers need individual identity (unlike Finance's single shared credential) —
~15-20 real named people per the pilot's approver reference table. Decision-maker chose Google
OAuth (everyone has a Google account); after reviewing Auth.js v5 (still beta-tagged on npm) the
decision-maker chose **`arctic`** (stable `3.7.0`) instead, reusing the app's own proven
HMAC-signed cookie session pattern rather than adopting a third-party session library.

- `platform/src/lib/google-oauth.ts` + test: thin `arctic` wrapper. `buildAuthorizationRequest`
  is directly testable (checks the constructed URL's params); `resolveGoogleProfile` calls
  Google's userinfo endpoint with the access token (arctic doesn't verify/decode ID tokens
  itself, so this is the standard pattern for this library) — not unit tested, same as other
  network-calling functions in this codebase (`sendStatusChangeEmail`, `uploadReceipt`).
- `platform/src/lib/user-session.ts`: generalizes `finance-auth.ts`'s HMAC-sign/verify pattern to
  carry a `userId`. Uses a separate cookie (`app_session`) from Finance's `finance_session` —
  fully independent, no shared state, Finance's existing login is completely untouched.
- `platform/src/app/api/auth/google/route.ts` + `callback/route.ts`: the OAuth redirect +
  callback, resolving/creating the matching `User` row by email (same pattern as
  `getOrCreateAccountantUser` in `finance/actions.ts`), backfilling `googleSub`/`picture`.
- `platform/src/app/requester-login/page.tsx`: separate "Sign in with Google" entry point, not
  merged into the existing Finance-only `/login` page.
- Schema: added nullable+unique `googleSub` and nullable `picture` to `User`. Applied via a
  manually-authored migration (`prisma migrate dev` refuses non-interactive shells in this
  Prisma version — used `prisma migrate diff --script` to generate the SQL, then
  `prisma migrate deploy`, which is designed for non-interactive/CI use) against the real
  Postgres.
- Added `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` /
  `APP_SESSION_SECRET` to `platform/.env.example`.
- Verified: `tsc --noEmit` clean, `node --test` 17/17 passing (2 new), `next lint` clean, `next
  build` succeeds with no Google/session env vars set (`/api/auth/google` and its callback both
  register as dynamic routes, `/requester-login` as static — none touched at build time).
- **Update (2026-08-28, later same day):** Google Cloud OAuth client provisioned (External
  audience, Testing mode, since requesters/approvers use personal Gmail rather than a CCF
  Workspace domain). Live-verified with a real sign-in: `User` row created with `googleSub`/
  `picture` populated, confirmed directly in the database.
- **Bug found and fixed during live verification:** the callback originally redirected to `/`,
  which unconditionally redirects to Finance's own unrelated login — since no requester-facing
  page exists yet, this made a successful Google sign-in look like it had failed. Fixed to
  redirect back to `/requester-login`, which now shows a signed-in state (name/email + sign out)
  instead of just the sign-in button once a session exists. Re-verified: signed-out shows the
  sign-in button, a valid session shows the correct signed-in account, sign-out clears it
  correctly back to signed-out.
- Also observed: a double-click on "Sign in with Google" can overwrite the in-flight OAuth state
  cookie, causing the first attempt to fail with `invalid_state` while a retry succeeds. Not
  fixed this slice — noted as a known rough edge, not a blocker.

## Slice 5: Create-DRAFT Request + Line Items (2026-08-28)
Second slice of the request-creation/approval-routing phase (see the Phase Transition entry
above). A signed-in requester can now create a `DRAFT` reimbursement request and add/remove
expense line items on it — no receipts, bank details, or submission yet (still separate later
slices per the roadmap).

- `platform/src/lib/request-types.ts` + test: human-readable labels for the `RequestType`/
  `MinistryType` enums (ministry labels match the pilot's original wording), with a test
  guarding that every enum value has a label.
- `platform/src/lib/money.ts`: extracted `formatAmount` out of `finance-data.ts` so
  `request-data.ts` doesn't duplicate it — both now import the same helper.
- Voucher numbering: added an atomic Postgres sequence (`voucher_no_seq`,
  `prisma/migrations/..._add_voucher_no_sequence`) per spec 0002's explicit call for a
  database-backed sequence, not `Math.random()`. Applied via the same manual-migration +
  `migrate deploy` route as the Google sign-in slice (`migrate dev` still refuses non-interactive
  shells).
- `platform/src/lib/request-data.ts` + test: `createDraftRequest`, `getDraftRequest` (scoped to
  the requester's own `DRAFT` rows only), `addLineItem`/`removeLineItem` (atomic
  increment/decrement on `totalAmount`, not a re-fetch-and-sum).
- **Real bug found and fixed during live testing, worth flagging clearly:** the first
  implementation used Prisma's *interactive* transaction form
  (`prisma.$transaction(async (tx) => {...})`) for `addLineItem`/`removeLineItem`. Live testing
  showed the first such transaction in a session always persisted correctly, but every
  subsequent one silently failed to persist its writes — no thrown error, no log line, just
  data that never showed up — in this exact stack (Prisma 7 + `@prisma/adapter-pg` + Next.js
  dev server, tested against Neon's pooled endpoint). Root cause not fully isolated (ruled out:
  the Neon pooler itself — a standalone script against both the pooled and direct connection
  strings worked fine outside of Next's request-handling context). Fixed by switching to the
  array-form `prisma.$transaction([...])` already used successfully in `finance-data.ts`,
  restructured around atomic `increment`/`decrement` so no operation depends on reading another
  op's result first. Verified with three sequential add/add/remove calls in one session — all
  three now persist correctly.
- **Second, separate bug found and fixed:** after switching to the array-transaction fix above,
  server-side data was confirmed correct (a raw `fetch()` to the page immediately after showed
  the right content), but the *browser* kept rendering the pre-mutation page. This was Next's
  client-side Router Cache not being busted by a Server Action's `redirect()` back to the exact
  page it was submitted from, even with `revalidatePath` called first. Fixed by converting the
  add/remove UI to a client component (`LineItemManager.tsx`, mirroring `StatusTransitionForm.tsx`'s
  existing `useTransition` pattern already used on the Finance side) that calls the actions
  imperatively and calls `router.refresh()` on success, rather than relying on a same-page
  Server Action redirect to refresh the client.
- Verified end-to-end with a real signed-in Google account: create draft → add two line items
  (correct running total) → remove one (total correctly recomputed) → confirmed against the
  database directly. `tsc --noEmit`, `next lint`, `node --test` (19/19 passing, 2 new in
  `request-types.test.ts`) all clean, `next build` succeeds.

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
