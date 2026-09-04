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
  requests (Alex Approver, Jordan Reyes, Morgan Cruz can unanimously override Regional Director
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
- `platform/src/app/sign-in/page.tsx`: separate "Sign in with Google" entry point, not
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
  register as dynamic routes, `/sign-in` as static — none touched at build time).
- **Update (2026-08-28, later same day):** Google Cloud OAuth client provisioned (External
  audience, Testing mode, since requesters/approvers use personal Gmail rather than a CCF
  Workspace domain). Live-verified with a real sign-in: `User` row created with `googleSub`/
  `picture` populated, confirmed directly in the database.
- **Bug found and fixed during live verification:** the callback originally redirected to `/`,
  which unconditionally redirects to Finance's own unrelated login — since no requester-facing
  page exists yet, this made a successful Google sign-in look like it had failed. Fixed to
  redirect back to `/sign-in`, which now shows a signed-in state (name/email + sign out)
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
- **Renamed `/requester-login` to `/sign-in`** (2026-08-28, later same day): the page was named
  for the requester side while it was still scoped narrowly, but the same Google sign-in serves
  approvers too (they'll sign in through this exact page once slice 8 adds approver-facing UI),
  so "requester-login" was already inaccurate, not something that would only become wrong later.

## Slice 6: Receipt Upload Wiring (2026-08-28)
Third slice of the request-creation/approval-routing phase. Connects the already-built
`receipt-storage.ts` (slice 3) to a real upload UI on the draft request — upload, view, remove.

- `platform/src/lib/request-data.ts`: `addReceiptRecord`/`removeReceiptRecord` (ownership/DRAFT
  guards via the new shared `assertOwnsDraftRequest`, factored out of the duplicated check
  `addLineItem` already had). `getDraftRequest` now computes each receipt's signed view URL at
  render time (see below for why) via `getReceiptDownloadUrl`.
- `platform/src/app/requests/actions.ts`: `uploadReceiptAction` validates the file
  (`assertValidReceiptFile`) and confirms draft ownership *before* the R2 upload, not just
  inside the DB write afterward, so an expired session doesn't waste an upload. `removeReceiptAction`
  deletes both the DB record and the R2 object (`deleteReceipt`, newly added to
  `receipt-storage.ts`, not previously needed).
- `platform/src/components/requests/ReceiptManager.tsx`: upload form + list, mirroring
  `LineItemManager.tsx`'s client-component pattern.
- **Real bug found and fixed during live testing:** the first "View" implementation fetched a
  signed URL via a Server Action on click, then called `window.open(url, "_blank", "noopener")`.
  This never worked: `noopener` makes `window.open()` return `null` by spec (that's the whole
  point of `noopener` — no handle back to the new tab), so there was nothing to navigate once the
  URL arrived. Fixing that alone wasn't enough either — even opening a blank tab synchronously
  and later setting `tab.location.href` proved unreliable in practice. Replaced entirely: each
  receipt's signed URL is now computed server-side in `getDraftRequest` at page-render time, and
  "View" is a plain `<a href target="_blank">` — native browser navigation, no click-time fetch
  or popup-window handling at all. Trade-off: the link can expire (5 min default) if the page
  sits open unclicked; reloading gets a fresh one. Acceptable for this scale.
- Verified end-to-end with a real signed-in Google account against the real R2 bucket and
  database: upload a PDF → confirmed in DB and R2 → View link's signed URL fetched directly
  returns the exact uploaded bytes → Remove deletes both the DB record and the R2 object →
  confirmed empty afterward. `tsc --noEmit`, `next lint`, `node --test` (19/19 passing) all
  clean, `next build` succeeds.

## Slice 7: Receipt Scanning — Provider-Agnostic OCR Extraction (2026-08-28)
Fourth slice of the request-creation/approval-routing phase. Adds an opt-in "scan receipt for
suggested information" feature on top of slice 6's upload/view/remove.

- **Course correction, worth recording:** the first implementation called the Anthropic API
  directly (Claude vision + structured output) and was fully built/tested. The decision-maker
  rejected committing to Anthropic for this feature and specified a different architecture
  instead: a provider-agnostic `ReceiptExtractionService` interface, **Google Cloud Vision
  Document Text Detection** (OCR only, no AI) as the first implementation (free tier covers
  pilot volume), and a different UX — one "Suggested information" card (Merchant/Date/Amount/GST)
  with Confirm/Edit, not a list of arbitrary suggested line items. The Anthropic code
  (`receipt-scan.ts`, `@anthropic-ai/sdk`) was removed entirely, not adapted.
- `platform/src/lib/receipt-extraction/`: `types.ts` defines the interface
  (`ReceiptExtractionService.extract({ buffer, contentType }) -> ReceiptExtractionResult`, every
  field nullable). `parse-receipt-text.ts` + test: pure, non-AI heuristic parsing of raw OCR text
  (merchant = first non-date/amount/ABN line; date via AU numeric/worded regexes; amount via a
  `TOTAL`-labelled line, falling back to the largest dollar figure; GST via a `GST`-labelled
  line). `google-vision-extractor.ts`: the I/O half, using the official `@google-cloud/vision`
  client with a service-account credential. `index.ts` is the swap point for a future provider.
- **PDF OCR without a storage redesign, worth recording:** PDFs needed to be scannable (not
  deferred), which meant service-account auth (Vision's plain API-key auth only covers the image
  endpoint). Confirmed directly against Google's API reference that Vision's *synchronous*
  `files.annotate`/`batchAnnotateFiles` endpoint accepts a PDF as inline base64 `content` — a
  `gcsSource` is one option on `InputConfig`, not a requirement — so the extractor downloads
  receipt bytes from R2 (already-existing `downloadReceiptBytes`) and sends them straight to
  Vision over HTTPS, server-side only. Google Cloud Storage is never introduced; R2 remains the
  app's only object storage (ADR 0002).
- `platform/src/app/requests/actions.ts`: `extractReceiptAction` replaces `scanReceiptAction`,
  same ownership-checked shape, never writes to the DB — confirming a suggestion still goes
  through the existing `addLineItemAction`.
- `platform/src/components/requests/ReceiptManager.tsx`: the scan button now renders one
  suggestion card (Merchant/Date/Amount/GST) with Confirm/Edit/Cancel, matching the
  decision-maker's mockup. Confirm calls `addLineItemAction` with the (possibly edited)
  merchant/amount, so a confirmed suggestion becomes an ordinary line item in the existing list —
  Date/GST are shown for context only, not persisted (no schema change).
- Known gap: Vision rejects HEIC receipts (confirmed live, despite some docs listing it) —
  scanning shows a clear "not supported, add manually" message; upload/view/remove for HEIC is
  unaffected. JPEG/PNG/GIF/PDF/TIFF are all scannable.
- Added `GOOGLE_VISION_CREDENTIALS_JSON` to `platform/.env.example` (service-account JSON,
  server-side only); removed the `ANTHROPIC_API_KEY` entry.
- Verified: `tsc --noEmit` clean, `next lint` clean, `node --test` all passing (7 new tests:
  5 for `parse-receipt-text.ts`'s heuristics, 2 for the file-type gate), `next build` succeeds
  with no `GOOGLE_VISION_CREDENTIALS_JSON` set. Live-verified against the real R2 bucket/database
  with a real signed-in Google account: upload still works, the scan action fails gracefully with
  a clear configuration error when Vision credentials aren't set (no crash, no suggestion card,
  nothing auto-populated), and view/remove are unaffected.
- **Update (2026-08-28, later same day): live Vision API round-trip verified**, after a GCP
  service account (`receipt-ocr@ccf-australia-platform.iam.gserviceaccount.com`, project
  `ccf-australia-platform`) was provisioned and billing linked (Vision requires an active billing
  account even within the free tier — the first attempt correctly failed closed with a clear
  `PERMISSION_DENIED: billing not enabled` message shown in the UI, rather than crashing, until
  that was fixed). Tested against both a real image and a real PDF built from the same receipt
  content: merchant ("Woolworths") and date extracted correctly for both file types, but the
  amount came back as the subtotal instead of the total, and GST wasn't found at all.
- **Real bug found and fixed from that live testing:** printed the actual raw OCR text Vision
  returned (`GoogleVisionReceiptExtractor` exposes it via `ReceiptExtractionResult.rawText`,
  called directly rather than through the UI) and found the root cause: a wide horizontal gap
  between a right-aligned label column and its amount column makes Vision read the whole label
  column first ("SUBTOTAL" / "GST" / "TOTAL" as three consecutive lines), then the whole amount
  column after it ("$14.27" / "$1.43" / "$15.70"), instead of keeping each label next to its own
  value — a genuine Vision OCR layout quirk, not something guessable from the plain text alone.
  Fixed in `parse-receipt-text.ts` with `pairColumnLabelsWithAmounts`: when a contiguous run of
  known label lines (subtotal/GST/total) is immediately followed by a contiguous run of
  amount-only lines of the same length, pair them positionally. Same-line matching is still tried
  first (still the common case and the most reliable); this column-pairing is the fallback. Added
  2 tests reproducing the real captured OCR shape and a simpler single-label-then-its-amount case
  (9/9 passing total). Re-verified live against the real Vision API after the fix: Merchant, Date,
  Amount ($15.70 — the actual total, not the subtotal), and GST ($1.43) all now correctly
  extracted end-to-end for a real image.

## Phase Transition: Finance Retires From the App (2026-08-30)
The decision-maker confirmed a real change to the business process, direct from a conversation
with Finance: **Finance will no longer log into the app at all.** Only requesters and approvers
use it (Google sign-in). Once a request clears the full approval chain, the app will automatically
email Finance the completed form (request type, ministry, line items, bank details) with the
receipt(s) attached; anything Finance needs after that is handled outside the app via direct
communication with the requester, not an in-app status-transition loop. Confirmed via three
targeted questions before building anything: the email fires **after full approval** (not at
initial submission), the old Finance login/queue/status UI is **removed entirely** (not left
dormant), and the email includes **bank details and all other form details**.

This retires the entire Finance V1 slice-1/2/3 system and means Bank Details must exist before
that eventual email can ever be sent, since Finance has no other way to see the payment account.
Updated roadmap: (4) Bank details, (5) remove Finance login — both this slice — then (6) My
Requests list, (7) approval-routing logic, (8) submit action — all three done in Slice 9, sooner
than originally sequenced, once the decision-maker's table+drawer redesign made them the natural
next increment — (9) approver UI, (10) tier-4 override, (11) Request Changes/re-approval, (12) on
full approval, render the form + receipts + bank details and email Finance (replaces the old
Finance-queue terminal step; a useful reference for "the correct form" layout found in the
pilot's own HTML-voucher-for-email code, `mvp/reimbursement-voucher/js/app.js` around the
`Bank Details for Payment` section).

## Slice 8: Bank Details + Retire Finance Login (2026-08-30)
- `BankDetails` model added (1:1 with `ReimbursementRequest`, per spec 0002's already-sketched
  shape — field names confirmed against the pilot's own form so Finance sees the same fields
  they're used to). `platform/src/lib/bank-details.ts` + test: pure BSB/account-number validation
  (`normalizeBsb`, `formatBsb`, `assertValidAccountNumber`), mirroring the
  `assertValidReceiptFile` pure/impure split. `upsertBankDetails` in `request-data.ts` reuses
  `assertOwnsDraftRequest`'s compound requester+DRAFT check and writes an `AuditLogEntry` that
  never includes the account number/BSB — the audit trail records that a change happened, never
  the sensitive values. `BankDetailsManager.tsx` (new client component, same
  `useTransition`/`router.refresh()` pattern as `LineItemManager.tsx`) adds a **"Confirm account
  number"** field that must match before saving — a lightweight anti-fat-finger safeguard for a
  field that determines where real money goes.
- Simpler than spec 0002 originally implied: since Finance never opens the app now, there's no
  Finance-side read-only view to build for bank details at all — owner-only until the future
  submit+email slice reads them server-side. Encryption-at-rest: relying on Neon's standard
  disk-level encryption + strict access control for now (app-level field encryption flagged as an
  explicit TODO in `schema.prisma`, since it needs key-management infrastructure this codebase
  doesn't have anywhere yet — a real decision, not a silent omission).
- **Finance login system removed entirely**, confirmed not to be left dormant: `/login`,
  `/finance` (queue + detail + layout + actions), `finance-auth.ts`, `finance-data.ts`,
  `components/finance/*` (+ their Storybook stories), `status-transitions.ts` (+ test),
  `types/finance.ts`, and `proxy.ts` (its only job was gating `/finance/*`, so the whole file is
  now dead). `notifications.ts` keeps its generic Resend client/from-address helpers (a future
  "email Finance the approved form" notification will want them) but loses
  `buildStatusChangeEmail`/`sendStatusChangeEmail`, which had no caller left once
  `finance/actions.ts` was deleted (confirmed via grep for actual imports, not just comment
  mentions, before deleting anything).
- **Real bug found and fixed along the way:** the root page (`/`) unconditionally redirected to
  `/finance` — a leftover from when Finance was the only audience. Now redirects to `/sign-in`.
- **Second, more significant bug found and fixed:** `npm test`'s glob
  (`node --test src/lib/**/*.test.ts`) turned out to have been silently running only a fraction of
  the suite since `receipt-extraction/` (a subdirectory under `src/lib/`) was added in slice 7 —
  this machine's `/bin/bash` has no `globstar` support, so `**` degrades to matching exactly one
  path segment. Before slice 7, every test file was flat in `src/lib/`, so the glob matched
  nothing and bash's default behavior (no `nullglob`) passed the literal unexpanded string to
  `node --test`, which has its own, correctly-recursive glob engine — working by accident. Once
  `receipt-extraction/` existed, bash could partially expand the pattern (matching only that one
  subdirectory), silently dropping every flat test file (`bank-details`, `google-oauth`,
  `notifications`, `receipt-storage`, `request-types`, `status-transitions`) from every
  `npm test` run since, in both local runs and CI. Confirmed the same undercount by running the
  literal glob string directly and counting matches (9 vs. the correct 33). Fixed by quoting the
  glob in `package.json` (`"src/lib/**/*.test.ts"`) so the shell never touches it, leaving Node's
  own glob engine to do the (correct) recursive discovery.
- Verified: `tsc --noEmit` clean, `next lint` clean, `node --test` 24/24 passing (33 minus the 9
  Finance-specific tests removed with `status-transitions.ts`/`notifications.test.ts`), `next
  build` succeeds (confirms no dangling imports from the Finance removal — route list now shows
  no `/finance`/`/login`, no Proxy/Middleware), `storybook build` succeeds. Live, with a real
  signed-in Google account: bank details save/persist/reload correctly, a deliberate
  account-number mismatch is rejected with a clear error, a *different* signed-in user gets a 404
  trying to open someone else's draft (bank details never leak across accounts), `/login` and
  `/finance` now correctly 404, `/` redirects to `/sign-in`, and line items/receipts are
  unaffected by any of the above (regression-checked).

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
  decision-maker that CCF Australia's requirement is a latency/locality preference, not a hard compliance
  guarantee, so R2 with the `oc` (Oceania) location hint stands as the storage choice. Amazon S3
  in `ap-southeast-2` remains the fallback if that ever changes — see ADR 0002's "Data residency"
  note for the technical reasoning.
- **Production deployment gap found and fixed (2026-08-28):** almost none of `.env.example`'s
  variables had ever been added to Vercel — only the Neon-integration DB vars and (once slice 7
  needed it) `GOOGLE_VISION_CREDENTIALS_JSON`. Every prior slice's live verification ran against a
  local dev server, so this had never surfaced. Google sign-in was the first thing actually
  exercised against the deployed app, and it 500'd (`GOOGLE_CLIENT_ID is not set`). Fixed by
  adding `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`GOOGLE_REDIRECT_URI`/`APP_SESSION_SECRET` to
  Vercel; `GOOGLE_REDIRECT_URI` needed its own production value
  (`https://ccf-australia-ops.vercel.app/api/auth/google/callback`, not the localhost one) which
  also had to be separately added to the OAuth client's Authorized redirect URIs in Google Cloud
  Console (Google rejects an unregistered redirect URI outright — `redirect_uri_mismatch`). A
  second, subtler issue after that: signing in from one of Vercel's per-deployment URLs (e.g.
  `ccf-australia-<hash>-ccf-melbourne.vercel.app`, what the dashboard's "Visit" button links to)
  rather than the stable `ccf-australia-ops.vercel.app` domain caused `invalid_state`, since the
  OAuth state/PKCE cookie is scoped to whichever hostname the flow started on, but Google always
  returns to the fixed `GOOGLE_REDIRECT_URI` hostname — a mismatch if those differ. Always start
  sign-in from the stable production domain, not a deployment-specific URL. Finance/Resend/R2 env
  vars are still not configured on Vercel — not yet urgent since nothing currently in production
  depends on them live (Finance login/queue was removed the same day this was found; Resend has
  no caller left either — see the Phase Transition below).
- **Vercel Hobby-plan branch deployment limit hit (2026-08-28):** merging PR #11 revealed
  deployments failing instantly (`BUILD_FAILED: Resource provisioning failed`, no build log at
  all — confirmed via the Vercel API, not guessed) once too many git branches existed. Fixed by
  merging the never-merged `docs/verify-r2-live` branch's one commit into `main` directly (no PR,
  a small docs-only update) and, since disabling deploys for a branch via `vercel.json`'s
  `git.deploymentEnabled` did **not** free a slot (only actual branch deletion did), merging the
  Track A pilot branch's full history into `main` via PR #12 so `pilot/reimbursement-voucher-test`
  could be deleted without losing it — it's the same code, just no longer a separate branch.

## Slice 9: My Requests Table + Drawer + Submit/Approval-Routing (2026-08-30)
The decision-maker noticed the draft request page had no Submit button and no way to see past
requests — closing that gap meant redesigning how a requester creates/edits a request (a table +
responsive drawer, replacing separate `/requests/new`/`/requests/[id]` pages) and finally
implementing Submit, which needed the approval-routing logic to decide required approver roles.

- **UX, confirmed with the decision-maker across several exchanges:** land on a table of all the
  requester's own requests after sign-in; a "Create Request" button opens a responsive drawer
  (wide panel on desktop, full-screen sheet on small screens — `w-full max-w-xl` gives that for
  free, no separate breakpoint needed) with only **Submit** and **Close** (no Cancel/Save, since
  every field already auto-saves as it's entered); each table row gets **Edit**/**Delete**
  (`DRAFT` only).
- `platform/src/app/requests/page.tsx` + `RequestsTable.tsx` + `RequestDrawer.tsx`: the drawer's
  content is driven by a `?open=<id>` search param rather than a separate route/client-fetched
  state — this was a deliberate architecture choice found during implementation, not the original
  plan (which assumed no deep link at all): it means the existing `router.refresh()` calls
  already inside `LineItemManager`/`ReceiptManager`/`BankDetailsManager` keep working completely
  unchanged, since `router.refresh()` re-runs the page's server component (which re-reads the
  search param and refetches), instead of needing to touch those three working components to add
  a refetch callback. A bonus: this also restores a shareable/bookmarkable link to a specific
  draft, which the original plan had assumed was being given up.
- **Real bug found and fixed via live testing:** the first version of the drawer's "create" step
  called `createDraftRequestForDrawerAction` on every dropdown change (so picking type then
  ministry felt fully auto-saving, matching the rest of the drawer). Rapid changes to both
  dropdowns before the first call resolved raced into **two separate drafts** — only the second
  became the one being edited, the first silently orphaned with no way to reach it except
  directly in the database. Fixed by creating the draft **once**, immediately, with sensible
  defaults the moment the drawer opens, then transitioning straight into the same edit view —
  changing type/ministry there is a single field's own independent update call, which has no such
  race. A `useRef` guard (not just React state) prevents Strict Mode's dev-only double-invoke of
  the creating effect from firing a second create.
- **Schema:** added `onDelete: Cascade` to `LineItem`/`Receipt`/`BankDetails`/`AuditLogEntry`'s
  relations to `ReimbursementRequest` (previously the Postgres default `RESTRICT`, hit directly as
  a real foreign-key error while writing this slice's own test cleanup code) so
  `deleteDraftRequest` can issue one `prisma.reimbursementRequest.delete()` after explicitly
  deleting each receipt's R2 object first (R2 isn't part of a Postgres cascade).
- `platform/src/lib/approval-routing.ts` + test: pure `getTier`/`getRequiredApproverRoles`.
  Checked the pilot's tested reference (`approval-rules.js`) directly rather than re-deriving the
  rules from memory, and found two things worth recording: its tier-4 rule is the
  **known-outdated** Oceana-only Regional Director rule (the confirmed rule, already recorded
  earlier in this project's history, applies to every ministry group — implemented that way, not
  the pilot's literal logic); and its named-approver reference data has real gaps (names only, no
  emails, and several role slots like Finance Overseer have no named person at all for *any*
  group). Confirmed with the decision-maker: `submitRequest` creates the correct
  `RequiredApproval` rows (role + tier) but leaves `approverUserId` `null` — resolving *who* fills
  each role is a separate, later slice (the approver-facing UI), not decided here. `submitRequest`
  goes straight to `IN_APPROVAL` (not `SUBMITTED`), since the approval rows are generated in the
  same atomic step — `SUBMITTED` would be a fleeting label with no distinct behavior.
- Also removed: `/requests/new`, `/requests/[id]`, `CreateRequestForm.tsx` (fully replaced, not
  kept alongside); `sign-in/page.tsx` now redirects straight to `/requests` once signed in
  (instead of an inline "you're signed in" block), and the OAuth callback redirects to
  `/requests` directly instead of `/sign-in`.
- Verified: `tsc --noEmit`, `next lint`, `node --test` (26/26, 2 new for `approval-routing.ts`),
  `next build` (route list confirms `/requests` replaced the old two routes), and
  `storybook build` all clean. Live, with a real signed-in Google account and a second throwaway
  account: full flow end-to-end (create → fill in line items/receipts/bank details → close → row
  shows `DRAFT` with Edit/Delete → Edit reopens pre-filled → Delete removes it from the database)
  confirmed exactly once, no orphaned duplicate; a second request at $6,000 (tier 4) submitted
  correctly created exactly the 4 expected unassigned `RequiredApproval` rows
  (`COS1`/`COS2`/`FINANCE_OVERSEER`/`REGIONAL_DIRECTOR`) and the table correctly showed
  `IN_APPROVAL` with Edit/Delete no longer available; confirmed the drawer renders full-width on
  a 375px viewport.

## Slice 10: Approver Assignment + Approver-Facing UI (2026-08-31)
The decision-maker supplied real approver identities across a series of exchanges, correcting
several assumptions this project had carried since the pilot: approvers are assigned **per
individual ministry type** (11, not the pilot's collapsed 5-group scheme — e.g. Pastoral Care has
its own overseer, distinct from Finance/NxtGen despite the pilot lumping them together), **there
is no COS2 anywhere** (one named person per ministry fills both `MINISTRY_OVERSEER` and `COS1`,
as two separate approval rows — a pre-existing gap in the pilot's own data, not something new),
and **Finance Overseer**/**Regional Director** are each a single **org-wide** person, not
per-ministry. `"Comms / Media / DGM"` also split into two ministry types (`COMMS_MEDIA`/`DGM`)
since they have different named approvers.

- `ApproverAssignment` model (role + optional `ministryType`, `null` = org-wide) + `prisma/seed.ts`
  extended to idempotently seed the 9 named `User` rows and 24 assignment rows (11 ministries × 2
  roles + 2 org-wide), run unconditionally near the top of `main()` — confirmed the existing
  demo-request seed block's early-return would otherwise silently skip anything placed after it.
  Morgan Cruz (no longer a ministry overseer) is seeded too, ready for the future tier-4-override
  slice they're still relevant to.
- **Real migration-generator bug found and fixed:** `prisma migrate diff`'s auto-generated SQL for
  splitting the `MinistryType` enum tried to `ALTER TABLE "ApproverAssignment"` *before* that
  table existed (it's created later in the same file) — a genuine ordering bug in Prisma's diff
  output for this "new table + simultaneous enum change" combination, not something we did wrong.
  Fixed by hand-editing the generated migration.sql to drop that erroneous line (a brand-new empty
  table doesn't need a data-preserving column-type conversion).
- **Found before migrating, worth recording:** 3 existing rows in the real database still used
  `COMMS_MEDIA_DGM` (the reseedable demo row, plus two of this session's own live-test artifacts).
  Deleted them as part of the migration rather than deciding an arbitrary mapping for test debris.
- `submitRequest` (`request-data.ts`) now resolves `approverUserId` via `ApproverAssignment` —
  `MINISTRY_OVERSEER`/`COS1` by the request's own ministry, `FINANCE_OVERSEER`/`REGIONAL_DIRECTOR`
  org-wide, `COS2` never looked up (no assignment exists for it anywhere, by design).
- New `platform/src/lib/approval-data.ts`: `getPendingApprovalsForUser` (deliberately excludes
  bank details — spec 0002's explicit access restriction) and `decideApproval` (a single rejection
  ends the chain → `REJECTED_RETURNED`; the request only moves to `APPROVED` once every required
  row is `APPROVED`). New `/approvals` route + `ApprovalsTable.tsx` (expandable rows, comment
  required to reject).
- **Mid-slice UX change, implemented same session:** the decision-maker asked for approvals and
  requests to land on **one combined page** instead of two routes with nav switching (since one
  person can be both a requester and an approver). `/requests` now renders the approvals table
  above the requests table; `/approvals` became a one-line redirect to `/requests` (kept, not
  deleted, so any existing link still lands somewhere sensible) rather than removed outright.
  `AppHeader.tsx` (new, shared between the two — since removed — layout files) simplified back
  down once the nav between them was no longer needed.
- Verified: `tsc --noEmit`, `next lint`, `node --test` (26/26) clean, `next build` (route list
  shows `/approvals` as a static redirect, `/requests` unchanged), `storybook build` clean.
  `npx tsx prisma/seed.ts` run twice against the real database confirmed idempotent (24
  `ApproverAssignment` rows, 9 users, no duplicates). Live: a tier-2 Admin request correctly
  produced 2 approval rows both assigned to Alex Approver, visible on their `/approvals` view with
  zero bank-detail fields anywhere on the page, and approving both moved the request to `APPROVED`;
  a tier-4 Oceana request correctly assigned `COS1`/`REGIONAL_DIRECTOR` to Robin Domingo and
  `FINANCE_OVERSEER` to Jordan Reyes with `COS2` left unassigned, and Jordan rejecting it
  immediately moved the request to `REJECTED_RETURNED` and hid the now-moot pending rows from
  Robin's view.
- **Follow-up (2026-08-31, same day):** `ReceiptManager`'s upload/remove/scan/confirm errors now
  surface via `sonner` toasts (`<Toaster/>` was already mounted in the root layout but nothing
  called it, since its only prior caller was Finance's status-transition UI, removed in slice 8)
  instead of inline red text — the inline version rendered errors from per-row actions (Remove,
  Scan) far below the row that triggered them, near the unrelated upload button. Scoped to just
  `ReceiptManager` for now, not the other forms, which still use inline text.
- **Follow-up (2026-08-31, same day):** the "at least one receipt required before submitting"
  check added in slice 9 is temporarily relaxed back to optional (commented out, not deleted) —
  decision-maker call to revert it to required before the official testing phase begins, same
  pattern as the deferred BankDetails field-level encryption.

## Slice 11: Design System, Dialog Extraction, App Shell (2026-09-02 – 2026-09-03)

- **Reminder emails + drawer Close button.** Stale-draft reminders (3-day/7-day) and pending-
  approval reminders (2/5/7-day), both via new Vercel Cron jobs; a day-0 "approval needed" email
  now fires when a role first becomes actionable (previously approvers got no email at all). A
  secondary Close button was added alongside each wizard step's own action row after backdrop-
  click-to-close was removed (stray clicks were dismissing the panel with a form half-filled).
- **Design system.** Scoped as a documentation-and-adoption pass, not a rebuild: Storybook
  already had `Foundations/{Colors,Spacing,Typography}` and four `Patterns/*` flow stories before
  this slice touched anything. Added the two missing Foundations pages (`Radius`, `Shadows`) and
  five missing Patterns pages (`FormSections`, `EmptyStates`, `LoadingStates`, `ErrorStates`,
  `ConfirmationStates`). `Button`/`Input` existed but were undapted at 6–7 real call sites
  (`ReceiptManager`, `LineItemManager`, `RequestDrawer`, etc.) — adopted there. Built and adopted
  five new components grounded in already-repeated patterns (`Select`, `Card`, `Badge`, `Alert`,
  `Table`), plus `FileDropzone` (extracted `ReceiptManager`'s drag-and-drop into its own
  documented component). No new dependencies added anywhere in this slice.
- **`Dialog` component + adoption.** Extracted the native-`<dialog>` shell duplicated three ways
  across `RequestDrawer`/`ApprovalDrawer`/`RequestProgressDrawer` into one `Dialog` component,
  documented in Storybook first and adopted into all three only after live verification, given
  this exact code's history of subtle bugs. Its `close()` is exposed via a `closeRef` the caller
  reads from anywhere (not a render-prop) specifically so `ApprovalDrawer`'s decide/reject
  handlers — top-level async functions, not inline JSX — can call it.
- **Three real bugs found and fixed along the way, each confirmed live before/after:**
  - Cancel on "Submit reimbursement?" closed the *entire* drawer, not just the confirmation. The
    confirmation was a second native `<dialog>` nested inside the first; closing it fired the
    *outer* dialog's native close event too — a genuine browser behavior in the modal-dialog
    stack (confirmed via an instrumented `.close()` + stack trace: nothing ever called it on the
    outer dialog). Fixed by replacing the nested dialog with a plain overlay instead of a second
    competing modal.
  - All three drawer panels had been rendering flush *left* the whole time despite `right-0` in
    their className — the browser's own `dialog:modal` stylesheet sets `left:0`, which wins in
    LTR when the box is otherwise over-constrained. Invisible until the confirmation-popup fix
    above made the mismatch visible. Decision-maker's call, once found: keep panels left-aligned
    going forward rather than force them back to the (never-actually-rendered) right side.
  - Removing the only receipt or line item, then clicking Continue, could bypass that step's own
    requirement — removal is an async round-trip, and the gating read the not-yet-updated prop
    with no signal a removal was still in flight. Fixed via an `onPendingChange` callback from
    `ReceiptManager`/`LineItemManager` up to the wizard step. Has a Storybook regression test
    (`Patterns/ExpensesStepRace`) — verified it actually fails when the fix is reverted.
- **App shell.** Replaced the old header-only shell (`AppHeader.tsx`, one nav-free page) with a
  sidebar + header shell (`AppShell`/`Sidebar`/`MobileNav`/`NotificationBell`/`UserMenu` under
  `platform/src/components/shell/`), a new `(app)` route group for the auth guard + shared shell,
  and a new `/dashboard` home page (stat cards, recent requests). `NotificationBell` shows the
  signed-in user's real pending-approval count (capped `9+`), not a decorative badge.
  - **Reverses a decision recorded in slice 10**, worth being explicit about: slice 10 explicitly
    combined Approvals and My Requests onto one `/requests` page *because* one person can be both
    a requester and an approver, and there was no nav to switch between two routes at the time.
    This slice splits them back into separate `/dashboard`/`/requests`/`/approvals` routes. The
    original problem doesn't reproduce the same way now — the new sidebar makes switching between
    them one click, unlike the old flat page with no navigation at all — but this is a considered
    reversal made without re-reading slice 10 first, not a decision that re-derived the original
    tradeoff from scratch. Flagging it here so a future slice doesn't re-litigate this blind.
  - `Settings` was deliberately left out of the sidebar (no feature exists yet to back it).

## Slice 12: CCF User Allowlist — Gate Google Sign-In on Server-Side Authorization (2026-09-04)

Found and closed a real access-control gap: the Google OAuth callback did an unconditional
`prisma.user.upsert(...)` on every successful sign-in, so any Google account — CCF-affiliated or
not — could sign in and get a working requester session. `User` had no concept of account status
at all. Querying the real database before fixing this found 46 real `User` rows already existed
from ordinary use, not just the 9 named approvers plus a demo account — confirming this wasn't
hypothetical.

Since CCF Australia's real users sign in with personal Gmail addresses (no Workspace domain to restrict to),
the fix is a new `User.status` (`ACTIVE`/`SUSPENDED`) allowlist, not a domain check — see
`adr/0003-ccf-user-allowlist.md` for the full model and reasoning. Concretely:
- The Google callback route no longer creates `User` rows at all — it only looks up an existing
  row by email and denies sign-in (one generic message, so the response can't be used to
  enumerate suspended vs. never-registered emails) if none exists or it isn't `ACTIVE`.
- A new `getCurrentActiveUserId()` (`src/lib/user-session.ts`) wraps the existing cookie-only
  `getCurrentUserId()` with a live status check, used by the `(app)` layout and every
  request/approval Server Action — so suspending someone takes effect immediately, not just at
  their next sign-in, even if they already hold a valid 30-day session cookie.
- A hand-written migration (`20260904013711_add_user_status`) backfilled every pre-existing row to
  `ACTIVE` before switching the column's default to `SUSPENDED` for anything created from that
  point on — nobody already legitimately using the app was locked out by this change.
- `prisma/seed.ts` now sets `status: "ACTIVE"` on create only (not on update), so re-running the
  seed script can never silently un-suspend someone an admin deliberately flipped via Prisma
  Studio. `src/app/api/dev/login/route.ts`'s own synthetic-identity upsert needed the same
  explicit `status: "ACTIVE"` treatment, or local dev sign-in would have broken the moment the new
  default landed.

Verified: full `tsc`/lint/test/storybook/build suite clean; queried the real database directly to
confirm all 46 pre-existing rows came back `ACTIVE` after the migration; exercised the actual
allow/deny query logic live against a known-real `ACTIVE` approver, a genuinely nonexistent email,
and a temporarily-created `SUSPENDED` test row (all four cases behaved correctly, test row cleaned
up after); re-ran `npm run db:seed` and confirmed it doesn't disturb existing status values; and
ran both `/api/dev/login` flows (requester and approver) end-to-end against a live dev server,
confirming `/dashboard` and `/approvals` still load correctly under the new
`getCurrentActiveUserId` gate.

No admin UI for provisioning new users exists yet, deliberately — for now, a new CCF requester who
isn't already a named approver is added as a `User` row via `prisma/seed-data.json` or Prisma
Studio (`npm run db:studio`) before their first sign-in. Revisit if/when manual provisioning
becomes a real bottleneck.
