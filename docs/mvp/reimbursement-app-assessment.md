# Reimbursement MVP — Deployment Readiness & Security Assessment

**Subject (original):** `.ai/tmp/CCF_form_final.html` (CCF Australia Melbourne — Disbursement Voucher)
**Subject (current):** `mvp/reimbursement-voucher/` (remediated pilot app; original file retired — see remediation section below)
**Track:** A — Reimbursement MVP Pilot
**Status:** Assessment findings below are the original, unmodified record. A remediation pass has since closed the CRITICAL findings — see "Remediation Status" immediately below. **Still not deployed.**
**Scope note:** This is a deliberately temporary, single-file HTML pilot. The goal of this review is to determine what must change before it touches real people and real bank data — not to bring it up to the standard of the future Operations Platform (see `docs/architecture/`).

---

## Remediation Status (Pilot Test Readiness Pass)

A follow-up remediation pass addressed the CRITICAL and self-approval findings below, scoped
strictly to what's required for **controlled internal testing** — not a rewrite, not the final
platform. Full detail in `docs/mvp/test-environment.md`. Code lives in
`mvp/reimbursement-voucher/` (the original `.ai/tmp/CCF_form_final.html` has been retired in
favour of this location).

### Fixed

| # | Finding | What changed |
|---|---|---|
| 2 | Formspree endpoint hardcoded/production-like | Endpoint now comes from `js/config.pilot.js` (`CCF_CONFIG.FORMSPREE_ENDPOINT`). App hard-blocks submission with a clear error if the config still contains the placeholder value — it can never silently submit to a guessed or broken endpoint. |
| 3 | Hardcoded real personal approver emails in client JS | Removed entirely from shipped code. `APPROVER_EMAIL_DIRECTORY` now lives in `js/config.pilot.js`, shipped empty with instructions that only pilot-tester-controlled addresses may go there. Verified via grep: no `gmail.com`/`yahoo.com` strings remain in `mvp/reimbursement-voucher/`. |
| 4, 5 | Bank details (account name/BSB/account number) unencrypted in localStorage | `saveForm()`/`loadSavedForm()` now use `collectDraftData()`, which excludes bank fields and the signature entirely. They are only ever held in memory for the duration of a submit/export action — never written to storage. |
| 6 | Stale localStorage draft (incl. bank data + signature) survives after successful submit | `confirmSubmit()` now calls `localStorage.removeItem('ccf_voucher_draft')` on success. Combined with the fix above, bank details/signature are never in localStorage in the first place. |
| 8a | Area/approver mapping bug — Oceana Regional Director requirement could never trigger | Root cause confirmed and fixed: approval routing was reading the physical-location field (`#ministryType`: Bendigo/Geelong/South East/Tottenham) instead of the Ministry Type field (`#area`: Admin/Finance/B1G/Comms/Oceana Regional/etc.), whose values never matched `APPROVERS_BY_MINISTRY`'s keys. `js/approval-rules.js` now maps all 10 Ministry Type values to their correct approval group via `getApprovalGroup()`, matching the on-page Ministry COS/Overseer Reference table. Regression-tested (see Tests below). |
| 10, 11 | No authentication; requester could self-approve by typing into the approver "signature" field | The approver signature/date inputs are now **always disabled** (previously only disabled for non-required approvers, i.e. required approvers' signature fields were freely typeable by the requester). Relabeled to "collected outside this system." A PILOT NOTE banner in the Approval section and in every export explains that approver fields are notification routing only, and approval must be confirmed separately by the approver. True authentication/authorization is explicitly deferred (see below) — this fix removes the misleading *implication* of an in-app signature, which was the specific harm in scope for this pass. |
| 13, 14 | XSS via unescaped `innerHTML`/`document.write`; CSV/Excel formula injection | Added `escapeHtml()` (used everywhere user-controlled text is inserted into HTML across the modal and all export formats) and `csvSafe()` (neutralizes leading `=+-@` in CSV/Excel cells). |

### Explicitly deferred (documented, not fixed)

These require the kind of investment this pilot is deliberately not making — they belong to the
future Operations Platform, not this file:

- Real authentication/authorization (finding #10/#11's underlying gap — anyone with the URL can
  still use the form; access control is handled at the *hosting* layer per the deployment
  checklist, not in-app).
- Server-side re-validation of approval tiers/amounts (finding #8b) — tier logic is still
  client-only; nothing stops a manipulated DOM/direct POST from bypassing it. Out of scope
  without a backend.
- A real system of record / database (finding #12).
- Digital receipt attachment (finding #9) — still no file upload; unchanged pending confirmation
  from the business owner on whether receipts are handled physically.
- Collision-resistant voucher numbering (finding #7) — still `Math.random()`-based.
- Formspree quota/failure-mode visibility (finding #2's LOW item), mobile approval-grid crowding
  (#18), `document.write`/Excel-warning-dialog UX quirks (#19) — cosmetic/operational, not
  blocking for a small briefed pilot group.
- Privacy notice/consent copy on the form itself (finding #16) — the TEST banner now makes the
  environment unambiguous, but no formal data-handling notice text has been added yet.

### Tests added

`mvp/reimbursement-voucher/tests/approval-rules.test.js` — 11 tests via Node's built-in
`node:test` (zero npm dependencies), covering:
- Tier boundaries at every threshold (≤$500, >$500–$2,000, >$2,000–$5,000, >$5,000).
- Required approvers for each tier.
- All 10 "Ministry Type" values mapping to their correct approval group, including the two
  values (`bendigo`, `geelong`, etc.) that must explicitly **not** match (they belong to the
  other, unrelated field).
- End-to-end regression for the confirmed bug: Oceana Regional at >$5,000 now requires
  `regional-dir`; every other group at >$5,000 does not.

Run with `cd mvp/reimbursement-voucher && node --test`. All 11 passing as of this remediation
pass.

### Remaining risk after this pass

Deploying `mvp/reimbursement-voucher/` today, even with the fixes above, still means: no
authentication (anyone with the link can use it), no server-side enforcement of approval rules,
and approval is fundamentally an email-notification-plus-manual-confirmation process, not an
in-system sign-off. These are acceptable for a small, access-restricted, time-boxed internal
pilot — not for anything wider. See the deployment checklist in `docs/mvp/test-environment.md`.

---

## Method

Full read of the single HTML file (1,939 lines: inline CSS, inline JS, no build step, no server). No live browser testing was performed as part of this pass — findings are from static code reading. Section 21 recommends the manual verification steps needed to confirm a few of these findings interactively.

---

## Findings by Area

### 1. External service integrations
- **Google Fonts** (`fonts.googleapis.com`) loaded via `<link>` — visitor IPs sent to Google on every page load. — **LOW**
- **Formspree** (`formspree.io/f/mjgdlgaq`) is the *only* backend. There is no CCF-controlled server anywhere in this app. — **MEDIUM** (architectural constraint, not a bug, but shapes everything below)

### 2. Formspree configuration
- The form endpoint ID (`mjgdlgaq`) is a production-looking Formspree form hardcoded in client JS (`FORMSPREE_URL`, line 525). Anyone who views source gets a working POST endpoint and can submit arbitrary data to it directly (via `curl`/script), bypassing the UI entirely — spam/abuse risk, and there's no CAPTCHA or rate limiting. — **HIGH**
- No separate test/pilot Formspree form is configured. If this file is deployed as-is for "internal testing," real test submissions will hit the same endpoint that (presumably) routes to real approvers. — **CRITICAL** for the stated goal of a *test* environment
- Formspree free-tier plans cap monthly submissions; there's no visibility into remaining quota and failures aren't distinguished from other errors (see #20). — **LOW**

### 3. Hardcoded email addresses
- `APPROVER_DIRECTORY` (lines 679–694) hardcodes ~11 real people's personal email addresses (Gmail/Yahoo) directly in client-side JS, visible to anyone via "View Source" — no login required. — **HIGH**
- These are personal, not organisational, addresses. Financial approval requests and completed vouchers (including bank details) will be emailed to personal inboxes outside any CCF-controlled mail system. — **HIGH**

### 4. Sensitive data handling
- Bank account name, BSB, and account number are collected, held in page state, saved unencrypted to `localStorage`, and transmitted as plaintext JSON to a third-party SaaS (Formspree), which then emails it to personal addresses. There is no encryption at rest or in client storage at any point. — **CRITICAL**

### 5. Bank account information
- Same data flow as #4, called out separately because it's the highest-sensitivity field on the form. Full BSB + account number + account holder name is retrievable by: (a) anyone with local/physical access to a device with a saved draft, (b) anyone with Formspree dashboard access, (c) anyone with access to the approvers' personal inboxes, (d) anyone able to intercept the fetch call if the deployment is ever served over plain HTTP. — **CRITICAL**

### 6. Browser localStorage
- `saveForm()` (line 1019) writes the *entire* form — including bank details and the base64-encoded signature image — to `localStorage['ccf_voucher_draft']` in plaintext, with no expiry.
- `clearForm()` (called after a successful submit, line 1003) resets form fields but **does not clear the saved localStorage draft**. Bank details and a signature image persist indefinitely in the browser after a successful, completed submission — a real risk on shared/kiosk devices. — **HIGH**
- `loadSavedForm()` runs automatically on every page load (line 1936) and silently restores whatever was last saved, including to a different person opening the same browser profile. — **HIGH**

### 7. Voucher number generation
- `DV-${year}-${random 100–999}` (lines 561–563, regenerated in `clearForm`) — purely client-side, `Math.random()`-based, no central registry. Collisions across users/sessions are likely, and there is no authoritative sequence. Not acceptable as a financial-audit identifier even for a pilot if any real vouchers are meant to be tracked by number. — **MEDIUM**

### 8. Approval logic — confirmed functional bug
- Static code inspection found the "Area" `<select id="ministryType">` (line 324) only ever holds values `bendigo | geelong | south-east | tottenham`, while `APPROVERS_BY_MINISTRY` (line 527) and the Oceana-specific branch (line 605: `if (area === 'oceana')`) are keyed on `admin | finance | b1g | comms | oceana`. These values can never match.
  - **Consequence A:** Approver name suggestions (`names[...]`, line 614) never populate — the reference names shown elsewhere on the form (Ross Callado, Joel Jerez, etc.) never appear in the approval grid.
  - **Consequence B:** The Tier‑4 Regional Director requirement for Oceana (`> $5,000`, documented in the on-page Approval Limits box) can **never** be triggered through the UI — the printed policy and the enforced logic have silently diverged.
  - This directly undermines the one control the form exists to enforce (routing high-value requests to the right approvers). — **CRITICAL**
- Separately: all tier/approver-count logic runs entirely in client JS with no server-side re-validation. Formspree accepts whatever JSON is POSTed — a user can edit the DOM/JS in devtools (or POST directly to Formspree) to submit a large amount with a single approver, and nothing downstream would catch it. — **HIGH**

### 9. Receipt handling
- There is no file upload control anywhere in the form (verified: no `<input type="file">`). The "Description / Receipts Attached" column is a free-text description field only — actual receipt images/PDFs are not captured or attached digitally at all. This is a functional gap for audit purposes, not a security bug — likely intended to be handled by a parallel physical/print process (canvas signature + Print button suggest a print-and-attach workflow), but it should be confirmed with the business owner rather than assumed. — **MEDIUM**

### 10. Authentication
- None. The page is a static file with no login, no session, no identity check of any kind. Anyone with the URL can open it, submit vouchers, and view all hardcoded approver PII in source. — **CRITICAL** (for anything beyond a locked-down test environment)

### 11. Authorization
- None. There are no roles. "Approval" in this app is a text field the *requester* fills in on the approver's behalf (name, email, and even a typed "signature" text input, line 668) — nothing requires the approver to actually interact with the system. A requester could type an approver's name into the signature field and self-approve their own request with no technical barrier. — **CRITICAL**

### 12. Data persistence
- No CCF-controlled datastore exists. The only records of a submission live in (a) the submitter's own browser `localStorage` (until cleared) and (b) Formspree's inbox/dashboard + resulting emails. There is no way to query, reconcile, or report on submitted vouchers as a set. Acceptable for a short pilot if explicitly scoped as "not a system of record," unacceptable if anyone expects to reconstruct history from it later. — **MEDIUM**

### 13. XSS risks
- Multiple places build DOM via `innerHTML`/`document.write` with unescaped user input: the submission summary modal (`openModal()`, approver names/descriptions, lines 826–841), and every one of the download generators (`downloadWord`, `downloadPDF`, `downloadPDFFile`, `downloadHTML`) interpolate raw `data.requesterName`, line-item descriptions, and approver names into HTML strings without escaping.
- Primarily self-XSS today (a user attacking their own browser session), but becomes a real stored/reflected XSS risk the moment voucher data is displayed anywhere outside the originating browser — e.g. if Formspree submissions or forwarded emails are later rendered as HTML in another tool, or if a future version adds a shared "view submissions" page. Worth fixing now since it's cheap, rather than carrying it forward. — **MEDIUM**

### 14. Injection risks
- **CSV/Excel formula injection:** `downloadCSV`/`downloadExcel` write user-entered description/name text directly into cells with no neutralization of leading `=`, `+`, `-`, `@`. If a description field starts with `=`, Excel/Sheets may treat it as a formula on open — classic CSV injection. — **MEDIUM**
- No SQL/database exists, so no SQL injection surface.

### 15. Dependency/external-resource risks
- Two external hosts are contacted at runtime: `fonts.googleapis.com` (cosmetic, fails gracefully) and `formspree.io` (functional — the whole submit flow depends on it, with only a generic try/catch around the `fetch`, no retry, no offline queueing). — **LOW–MEDIUM**
- No package manager, no build step, no third-party JS libraries — small, auditable dependency surface, which is a genuine strength of this approach for a short pilot.

### 16. Privacy concerns
- Real individuals' personal email addresses are embedded in a client-visible artifact (#3) — a personal-data exposure if this file's URL becomes reachable outside the intended pilot group. Under Australian Privacy Act expectations, collecting bank details and routing them to a US-based third-party SaaS (Formspree) without any privacy notice, consent language, or disclosed data-handling explanation on the form is a gap worth closing even for a pilot. — **HIGH**
- No statement on the form about what happens to submitted data, how long it's retained, or who can see it.

### 17. Deployment requirements
- The file is fully static (inline CSS/JS, no build) — trivially hostable on any static host (Netlify, Vercel, GitHub Pages, S3+CloudFront). Minimum requirements before any deployment: HTTPS-only, some form of access restriction (see recommendation below), and a **non-production Formspree endpoint** so pilot testing doesn't email real approvers real (fake) financial data during testing. — **HIGH** (process requirement, not a code defect)

### 18. Mobile behaviour
- Responsive breakpoint at 640px adjusts grids to single/double column and shrinks the line-item table (lines 242–251). Signature canvas supports touch events correctly (`touchstart/move/end` with `preventDefault`, line 752–754). The 5-card approval grid becomes 2-per-row on mobile, which will be visually cramped with 3–4 required approver cards — worth a manual check on a real phone. Not verified live in this pass. — **LOW**

### 19. Browser compatibility
- Uses modern-but-widely-supported JS (fetch, template literals, canvas, `URL.createObjectURL`) — fine on current evergreen browsers, no IE11 concern expected for an internal pilot.
- Relies on `document.write()` into a `window.open()` popup for the "PDF (print dialog)" option — deprecated, frequently blocked by popup blockers and some browser extensions, and unreliable in Safari/iOS. The "Excel" export is actually an HTML table served with an `.xls` extension, which triggers Excel's "file format doesn't match extension" warning dialog on open — functional annoyance, not a defect that blocks use. — **LOW**

### 20. Error handling
- `submitForm()` validation surfaces only the *first* validation error at a time via a toast (line 800) rather than listing everything wrong at once — minor UX friction, not a defect.
- `confirmSubmit()`'s catch block reports a generic failure message but cannot distinguish "Formspree quota exceeded," "network offline," and "Formspree rejected payload" from one another, and there's no logging/telemetry, so a systemic failure (e.g. hitting the free-tier submission cap) would look like isolated user error reports with no way for an admin to notice the pattern. — **MEDIUM**

---

## Severity Summary

| Severity | Count | Items |
|---|---|---|
| CRITICAL | 6 | Formspree endpoint is production not test (#2), bank data handling (#4), bank data exposure surface (#5), approval-routing logic bug (#8a), no authentication (#10), no real authorization / self-approval possible (#11) |
| HIGH | 8 | Formspree endpoint is a public spammable POST target (#2), hardcoded personal emails (#3), stale localStorage draft after submit (#6, two findings), client-only tier/approver enforcement (#8b), privacy/consent gap (#16), no access restriction on deployment (#17) |
| MEDIUM | 7 | Formspree as sole backend (#1), voucher number collisions (#7), receipts not digitally attached (#9), no system of record (#12), XSS via unescaped innerHTML/document.write (#13), CSV/Excel formula injection (#14), undifferentiated submit-error handling (#20) |
| LOW | 5 | Google Fonts external call (#1), Formspree quota blind spot (#2), external dependency fragility (#15), mobile approval-grid crowding (#18), deprecated `document.write`/Excel warning dialog (#19) |

---

## Answers to the Four Questions

### 1. Can this MVP safely be deployed for internal testing?
**Not as-is.** The blockers aren't cosmetic — they're the exact things a financial-approval pilot can't get wrong: real bank account numbers flowing to personal Gmail/Yahoo inboxes through a public third-party endpoint, an approval-routing rule that's silently broken (Oceana Regional Director sign-off can never trigger), and no actual authorization control (a requester can type in the approver's name themselves). It can be made safe for a *scoped* internal test relatively quickly — see the deployment approach below — but not by simply uploading the file somewhere public today.

### 2. What must be fixed before deployment?
Minimum bar for a genuinely "internal test" (not production) deployment:
1. Point `FORMSPREE_URL` at a **dedicated test Formspree form**, notifying only a small internal test group's addresses — not the real approver directory. (#2, #3)
2. Fix the `ministryType`/`APPROVERS_BY_MINISTRY` key mismatch so approval routing actually enforces the documented tiers, especially the Oceana Regional Director rule. (#8a)
3. Restrict access to the deployed URL (see recommended approach below) so it isn't publicly discoverable — this is the cheapest way to blunt #3, #10, #11 for a pilot without a real auth system. (#10, #17)
4. Clear the saved `localStorage` draft (not just form fields) on successful submit, and consider not persisting bank details in `localStorage` at all for anyone but the active drafting session. (#6)
5. Escape user-controlled text before inserting into `innerHTML`/`document.write`, and neutralize leading `=+-@` in CSV/Excel export cells. (#13, #14)
6. Add a short on-form data-handling notice (what's collected, where it goes, that it's a test environment) so pilot participants aren't surprised. (#16)

Everything else in HIGH/MEDIUM is worth fixing but doesn't need to block a *first, tightly-scoped* internal test — see below.

### 3. What can wait until the real platform?
- Real authentication/authorization, a server-side system of record, digital receipt attachment, a collision-proof voucher numbering scheme, server-side re-validation of approval tiers, and replacing Formspree with a proper backend. These are exactly the kind of investment this pilot is explicitly *not* meant to make — they belong in the CCF Australia Operations Platform (per `docs/architecture/`), not retrofitted into this single-file app.
- Cross-browser/PDF export polish (`document.write` popup approach, `.xls`-via-HTML warning dialog) — annoying but not a blocker for a small, briefed pilot group.

### 4. Recommended deployment approach
- Host the static file on a platform that supports simple access control without needing a login system — e.g. Netlify/Vercel with **HTTP Basic Auth** on the deployment, or a password-protected/unlisted link, restricted to the specific pilot testers only. This directly mitigates the "anyone with the URL" exposure (#3, #10, #11) without building real auth.
- Use a **separate test Formspree account/form** so no real approver or real bank data touches this deployment until the fixes above are verified.
- Treat this as a **short, time-boxed pilot** (e.g. 1–2 weeks) with a small, named group of testers who are told explicitly it's a test environment and not to enter real bank details — or, better, seed it with clearly fake test data so no real financial PII is at risk even if something leaks.
- Do not link to or advertise the URL anywhere public (no README, no public Slack channel, etc.) until the CRITICAL items are closed.

### 5. Recommended test strategy
- **Functional walkthrough per tier:** manually submit one voucher at each approval tier (≤$500, $500–2,000, $2,000–5,000, >$5,000, and >$5,000 with the Oceana area) and confirm the *correct* approvers are actually required and that the fixed routing logic (#8a) now works for all four "Ministry Type" groupings against all four "Area" values.
- **Draft/localStorage lifecycle check:** save a draft, submit successfully, reload the page, and confirm no stale bank/signature data resurfaces.
- **Cross-device/browser smoke test:** run the golden path (fill → sign → submit) on desktop Chrome/Safari and at least one mobile browser (iOS Safari touch signature is the highest-risk interaction).
- **Formspree failure-mode check:** temporarily point at an invalid endpoint or throttle network to confirm the error toast is clear and the form doesn't lose the user's entered data.
- **Access-control check:** confirm the deployed URL actually requires the configured credential/password from a fresh, unauthenticated browser session.
- **Data-exposure check:** view-source the deployed page and confirm no real approver PII or production Formspree ID is present if using a test configuration.

---

## What was explicitly *not* done in this pass
- No code was modified.
- Nothing was deployed or provisioned.
- No live browser/interaction testing was performed — findings on mobile rendering, popup-blocker behavior, and Excel warning dialogs are from static code reading and should be manually confirmed before sign-off.
