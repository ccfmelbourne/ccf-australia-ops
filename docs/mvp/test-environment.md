# Reimbursement MVP — Test Environment Guide

**App location:** `mvp/reimbursement-voucher/`
**Track:** A — Reimbursement MVP Pilot (unrelated to the Operations Platform work under `docs/architecture/`)
**Status:** Code-complete for the CRITICAL remediation pass described in `docs/mvp/reimbursement-app-assessment.md`. Not yet deployed — see the "Before you can actually pilot-test this" checklist below.

This file exists because requirement #5 of the remediation task ("introduce a clear configuration mechanism so TEST and future PRODUCTION settings cannot accidentally be mixed") asked for the mechanism to be documented, not just built.

---

## What changed structurally

The original single-file `.ai/tmp/CCF_form_final.html` has been split into:

```
mvp/reimbursement-voucher/
  index.html                    — markup + CSS (unchanged from the original, cosmetically)
  js/approval-rules.js          — pure approval-tier/routing logic (no DOM). Loaded in the
                                   browser AND required() by tests — zero npm dependencies.
  js/config.example.js          — template documenting the config shape. Not loaded by
                                   index.html; copy it when creating a new environment config.
  js/config.pilot.js            — the actual TEST config index.html loads today.
  js/app.js                     — all DOM wiring, form behaviour, Formspree submission,
                                   downloads/exports (CSV/Excel/Word/PDF/HTML).
  tests/approval-rules.test.js  — automated tests for js/approval-rules.js (Node's built-in
                                   test runner, node:test — no npm install needed).
```

This split was the minimum needed to (a) make the approval logic unit-testable without adding
a test framework/dependency, and (b) let TEST/PRODUCTION configuration live in separate files
instead of a hardcoded constant.

Nothing about the visual design, field layout, or day-to-day user flow changed.

## Why config.pilot.js, not config.test.js

Node's built-in test runner (`node --test`) auto-discovers any file matching `*.test.js` (or
inside a `test`/`tests` directory) and tries to execute it as a test. A file named
`config.test.js` gets swept up and crashes with `ReferenceError: window is not defined`. The
TEST config is therefore named `config.pilot.js` — its `ENVIRONMENT` value inside is still
`'TEST'`.

## How the environment mechanism works

- `index.html` loads exactly one config file via `<script src="js/config.pilot.js">`, before
  `js/app.js`.
- That config file sets `window.CCF_CONFIG = { ENVIRONMENT: 'TEST', ... }`.
- `app.js` calls `assertValidEnvironment()` on startup. If `CCF_CONFIG.ENVIRONMENT` is anything
  other than the literal string `'TEST'` or `'PRODUCTION'`, the app refuses to initialize and
  shows a blocking configuration-error message instead of guessing or falling back silently.
- A visible banner is injected at the top of the page reflecting the active environment (amber
  "TEST ENVIRONMENT" banner today).
- `confirmSubmit()` also hard-blocks (with a clear toast, not a silent failure) if
  `FORMSPREE_ENDPOINT` still contains the placeholder text `REPLACE_WITH` — so an unconfigured
  deployment cannot accidentally submit to a broken or guessed endpoint.
- There is **no `config.production.js` in this repo.** `.gitignore` blocks
  `mvp/reimbursement-voucher/js/config.production.js` and `config.local.js` from ever being
  committed, because a real production config will contain real approvers' personal email
  addresses (personal data, even though — see below — none of this is a "secret" in the
  security sense).

### Why there's no real secret here

This is a 100% static, client-side app with no server. Anything in a config file the browser
loads is visible to anyone who views source, opens devtools, or inspects the network tab —
there is no way to hide it. `FORMSPREE_ENDPOINT` is not a credential; it's a public form action
URL, the same as it was hardcoded in the original file. The thing worth protecting is not
secrecy of the endpoint — it's **not routing real people's real bank details to a form that
emails real personal inboxes** while this is still a test. That's what the TEST/PRODUCTION
separation actually defends against.

## Required configuration values

| Key | Required? | Meaning |
|---|---|---|
| `ENVIRONMENT` | Yes | Must be exactly `'TEST'` or `'PRODUCTION'`. App refuses to start otherwise. |
| `FORMSPREE_ENDPOINT` | Yes | Formspree form URL this environment submits to. TEST and PRODUCTION must never share one. |
| `SUBJECT_PREFIX` | No (recommended for TEST) | Prepended to the notification email subject, e.g. `[TEST — CCF Reimbursement Pilot]`. |
| `APPROVER_EMAIL_DIRECTORY` | No | Lowercased full name → email, used only for the "Approver Email" autofill convenience. TEST config must only contain addresses the pilot group actually controls. |

See `js/config.example.js` for the annotated template.

## Before you can actually pilot-test this

Two things only a human with the right account access can do — I could not provision these:

1. **Create a dedicated test Formspree form** (a free Formspree account is enough) and paste its
   endpoint URL into `FORMSPREE_ENDPOINT` in `mvp/reimbursement-voucher/js/config.pilot.js`,
   replacing the `REPLACE_WITH_TEST_FORM_ID` placeholder.
2. **Decide who the test recipients are** (e.g. the pilot coordinator's own inbox, or a small
   named group of testers who've agreed to receive test notifications) and add them to
   `APPROVER_EMAIL_DIRECTORY` in the same file. Do not use real approvers' personal addresses.

Until both are done, the app will detect the placeholder and refuse to submit — it will not
fail silently or post to a broken/real endpoint.

## Known Issue: Formspree Spam Filtering

Encountered during this pilot's setup: a freshly created Formspree form initially routed
legitimate submissions (including manually-submitted, non-automated ones) to Formspree's
**Spam** tab instead of delivering a notification email — even though the API still returned
`{"ok": true}` to the app.

The issue was related to Formspree's spam-filtering configuration rather than an application
error. In the Formspree dashboard, disabling the spam-filtering/reCAPTCHA sensitivity setting
resolved delivery immediately.

If setting up a new Formspree form for this pilot in the future (e.g. rotating to a fresh
test form, or eventually creating a production form), check the spam-filtering configuration
before testing submissions.

Also manually review the Spam tab during initial testing and mark legitimate submissions as
**Not spam** where appropriate.

## Running the app locally

It's static HTML/JS — no build step, no dev server strictly required:

```
open mvp/reimbursement-voucher/index.html
```

(A local static server, e.g. `npx serve mvp/reimbursement-voucher`, avoids any `file://`
quirks in some browsers if you hit issues — optional.)

## Running the tests

Requires Node.js (any recent LTS; verified against v24.19.0). No `npm install` needed — the
tests use only Node's built-in `node:test` module.

```
cd mvp/reimbursement-voucher
node --test
```

Expected: 11 passing tests covering tier boundaries, the Ministry-Type → approval-group mapping
(all 10 values), and the Oceana `> $5,000` Regional Director regression.

## Deployment prerequisites checklist

- [ ] `FORMSPREE_ENDPOINT` in `js/config.pilot.js` points to a dedicated TEST Formspree form (not
      a guess, not the original production-looking ID).
- [ ] `APPROVER_EMAIL_DIRECTORY` in `js/config.pilot.js` contains only addresses the pilot group
      controls.
- [ ] `node --test` passes locally before deploying.
- [ ] Hosting is access-restricted (e.g. HTTP Basic Auth on Netlify/Vercel, or an unlisted/
      password-protected link) — this app still has no authentication of its own.
- [ ] The deployed URL is not linked from anywhere public (README, public Slack, etc.).
- [ ] Pilot testers are briefed that this is a TEST environment and told not to enter real bank
      details (or, better, given clearly fake test data to use).
- [ ] A short, time-boxed pilot window is agreed (e.g. 1–2 weeks) with a named, small test group.

This checklist mirrors the "Recommended deployment approach" and "Recommended test strategy"
sections of `docs/mvp/reimbursement-app-assessment.md`, which still apply in full.
