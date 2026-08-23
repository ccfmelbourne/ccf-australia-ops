# Reimbursement MVP — Deployment Plan (Vercel Test Environment)

**Status: PLANNING ONLY. Nothing in this document has been executed. No deployment, domain, or paid service has been created.**

**App:** `mvp/reimbursement-voucher/` (static HTML/CSS/JS, no build step, no framework, no database, no in-app auth — unchanged by this plan)
**Track:** A — Reimbursement MVP Pilot
**Depends on:** `docs/mvp/reimbursement-app-assessment.md` (findings + remediation status), `docs/mvp/test-environment.md` (config mechanism, local run/test instructions)

This plan answers, in order: exact Vercel project configuration, build/output configuration,
environment/configuration requirements, how `config.pilot.js` should be handled, how production
config is kept from being used by accident, the recommended access-control approach and pilot
tester access model, whether Vercel alone is sufficient, whether Cloudflare Access would be
preferable, and the security limitations of the proposed setup. Facts below on Vercel's
Deployment Protection features were verified against current Vercel documentation, not assumed.

---

# Hosting

**Provider:** Vercel, personal/Hobby (free) plan. No upgrade, no paid add-on, no new account
credentials beyond the individual's own free Vercel signup (GitHub OAuth login is sufficient —
no separate password to manage).

**Project configuration (exact settings to use when the project is created):**

| Setting | Value | Why |
|---|---|---|
| Framework Preset | `Other` | Plain static HTML/CSS/JS — no framework to detect. |
| Root Directory | `mvp/reimbursement-voucher` | Scopes the deployment to just this app. Vercel does not serve files outside the Root Directory unless "Include source files outside of the Root Directory" is explicitly enabled — **leave that option OFF.** This is a real security boundary, not just tidiness: it keeps `docs/mvp/reimbursement-app-assessment.md` (which lists the app's own past vulnerabilities), `.ai/`, `adr/`, and everything else in the repo out of the deployed site entirely. |
| Build Command | *(empty)* | No build step exists or is being introduced. |
| Output Directory | *(default — the Root Directory itself)* | `index.html` is served as-is. |
| Install Command | *(empty / skip)* | No dependencies to install (the app has zero npm dependencies; the test suite's `node:test` usage is dev-only and irrelevant to what's served). |
| Git integration | Connect the existing GitHub repo | Standard Vercel Git integration; no separate CI needed. |
| **Production Branch** | An unused/orphan branch, e.g. `vercel-unused-production-branch` (NOT `main`, NOT the pilot branch) | See "Access Control" — this is the key setting that keeps every real deployment classified as a **Preview** deployment, which is the free, automatically-protected tier. Vercel's default free protection (Vercel Authentication) explicitly does **not** cover the most recent Production deployment — only Preview deployments. Redirecting "Production Branch" to a branch nothing is ever pushed to means CCF's actual pilot deployments never accidentally become the unprotected one. |
| Deploy source branch | `pilot/reimbursement-voucher-test` (new branch, created off `main`, containing only this remediated app) | Keeps `main` (the Track B foundation-phase branch) untouched by pilot deployment activity. |

No `vercel.json` exists in the repo yet. Recommended content to add **at deployment time** (not
now, per "do not modify application functionality unless required for deployment" — headers are
deployment configuration, not app functionality, so this is the one exception worth flagging):

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Robots-Tag", "value": "noindex, nofollow" },
        { "key": "Referrer-Policy", "value": "no-referrer" },
        { "key": "X-Content-Type-Options", "value": "nosniff" }
      ]
    },
    {
      "source": "/index.html",
      "headers": [
        { "key": "Cache-Control", "value": "no-store" }
      ]
    }
  ]
}
```

`X-Robots-Tag: noindex` stops the test URL from ever appearing in search results.
`Cache-Control: no-store` on `index.html` ensures a browser always fetches the latest config
guard/banner logic rather than a stale cached copy that might predate a fix.

---

# Test URL

Provider-generated only — **no custom domain, no DNS purchase, matching the stated constraint
that CCF has no production domain yet.**

Because the pilot branch is *not* the Production Branch, Vercel issues a stable per-branch
Preview URL of the form:

```
https://reimbursement-voucher-git-pilot-reimbursement-voucher-test-<scope>.vercel.app
```

(exact slug depends on the project/team name Vercel assigns — confirmed at project-creation
time, not before). Prefer sharing this **branch-alias URL** over the ephemeral per-commit URL
(`https://reimbursement-voucher-<hash>-<scope>.vercel.app`), since the branch-alias URL stays
constant across redeploys to the same branch, while the per-commit one changes every push.

This URL is **not public by default** — see Access Control.

---

# Configuration

- `index.html` loads `js/config.pilot.js` (already committed, already the only config file the
  page references) — nothing about config loading changes for deployment. Vercel's
  Environment Variables feature (build-time / server-side) does **not** apply here: there is no
  build step and no server, so there is nothing for it to inject into. The static, committed
  `config.pilot.js` file *is* the configuration mechanism, by design (see
  `docs/mvp/test-environment.md` → "Why there's no real secret here").
- Before the first real deployment, a human must still fill in the two placeholders in
  `mvp/reimbursement-voucher/js/config.pilot.js`:
  - `FORMSPREE_ENDPOINT` → a dedicated TEST Formspree form's URL.
  - `APPROVER_EMAIL_DIRECTORY` → only addresses the pilot test group actually controls.
  Until these are filled in, `app.js`'s `confirmSubmit()` guard blocks submission with a clear
  error rather than posting to a broken or guessed endpoint. **This plan does not fill them in —
  that's a deployment-time action, and this task is planning-only.**
- `assertValidEnvironment()` in `app.js` still hard-stops the app if `CCF_CONFIG.ENVIRONMENT`
  isn't exactly `'TEST'` or `'PRODUCTION'` — unchanged, and this is what makes the environment
  banner and submission guard trustworthy regardless of hosting provider.

## How production configuration is kept from accidentally being used

Three independent layers, so no single mistake causes it:

1. **The file doesn't exist.** There is no `config.production.js` anywhere in the repository —
   `.gitignore` blocks it from ever being committed. It cannot be deployed by accident because
   it cannot be checked in by accident.
2. **The script tag is hardcoded.** `index.html` has a literal `<script src="js/config.pilot.js">`
   — not a templated or environment-variable-driven path. Nothing at deploy time selects a
   config file dynamically; whatever is committed on the deployed branch is what ships.
3. **Branch isolation.** The Vercel project's Root Directory + dedicated pilot branch mean this
   deployment only ever builds from `pilot/reimbursement-voucher-test`. A future production
   setup would be a **separate Vercel project** (see Production Migration Notes) pointed at a
   different branch/domain — never the same project promoted in place. There is structurally no
   path from "pilot test deployment" to "production deployment" without a deliberate, separate
   setup step.

---

# Access Control

## Recommended approach: Vercel Authentication + a single Sharable Link (free, no upgrade)

1. Because the pilot branch is never the Production Branch (see Hosting), every pilot deployment
   is classified as a **Preview** deployment. Vercel Authentication is **automatically enabled
   on all plans, including Hobby**, for all deployments except the most recent Production one.
   Anyone hitting the URL without authorization is redirected to a Vercel login/access-request
   wall — the raw URL is not viewable by an anonymous visitor.
2. From the deployment's **Share** panel, create one **Sharable Link** ("Anyone with the link").
   This lets people access the protected deployment via a secure query-string token **without
   needing a Vercel account** — the same UX as sharing a Google Doc link. Personal/Hobby accounts
   can manage Sharable Links for their own deployments for free.
3. Distribute that single link privately (e.g. direct email or DM, not a public/shared channel)
   to the named pilot tester list.
4. To revoke access instantly (e.g. pilot ends, link leaks), switch the Share setting back to
   "Only people with access" from the same panel — this immediately invalidates the link.

**Hobby-plan limitation to plan around:** a personal Vercel account can have only **one**
Sharable Link active in total, account-wide, at any time. That's fine for this pilot (one
deployment, one link, one tester group) but means this mechanism doesn't scale to "a different
revocable link per tester" without upgrading — revocation is all-or-nothing.

## Recommended pilot tester access model

- A small, **named** list of testers (per `docs/mvp/test-environment.md`'s pilot safety rules).
- No Vercel account required for testers — they only need the one Sharable Link.
- The link is sent directly to each person (or a short named list), not posted to a broad or
  public channel.
- The pilot coordinator is the one person who creates/revokes the Sharable Link and therefore
  controls the access list in practice (add someone → forward the link; end the pilot → revoke).

## Is Vercel alone sufficient?

**Yes, for this pilot's threat model** — a short, time-boxed internal test with a small named
group and (per the Pilot Safety Rules) no real financial data expected to be entered — provided
the specific configuration above is followed (pilot branch ≠ Production Branch, Sharable Link
used, link distributed privately). It is a real access-control boundary enforced at Vercel's
edge, not mere "security through obscurity" — an unauthenticated visitor without the link cannot
load the page at all.

It is **not** sufficient for anything beyond that: there's no per-user identity, no audit log of
who actually opened the link, and no way to revoke a single tester's access without revoking
everyone's (Hobby's one-link limit). Vercel's actual **Password Protection** feature (a
proper, always-on password gate independent of a shared link) requires either an Enterprise plan
or a **$150/month** Advanced Deployment Protection add-on on Pro — explicitly out of scope here
per "do not create or use production credentials" / no paid services.

## Would Cloudflare Access be preferable?

In principle, yes — Cloudflare Access gives real identity-based access (per-person email
one-time-PIN or SSO, individual add/remove, audit logs), which is a meaningfully stronger model
than a shared link. **But it isn't usable today under the stated constraints.** Cloudflare Access
requires the protected hostname to belong to a domain zone actually onboarded to Cloudflare's own
DNS (or be reachable via a Cloudflare Tunnel from an origin CCF controls). CCF has no domain yet,
and a bare `*.vercel.app` hostname isn't something Cloudflare can front without one. Acquiring a
domain solely to enable this would violate "do not purchase a domain" / "do not configure
production services" for what's meant to be a temporary test.

**Recommendation:** use Vercel Authentication + Sharable Link now; treat Cloudflare Access as the
upgrade path once CCF has a real domain for the production platform (see Production Migration
Notes) — at that point it should front the production deployment, not necessarily this pilot.

## Security limitations of the proposed setup (be explicit with stakeholders about these)

- **Link-based, not identity-based.** Anyone with the link can access the form, indefinitely,
  until it's revoked — there's no way to tell who actually used it.
- **One shared secret for the whole group.** If it's forwarded, pasted into a public Slack
  channel, or shows up in someone's browser history on a shared computer, every tester's access
  is compromised equally, and the fix (revoke + regenerate + redistribute) affects everyone.
- **No audit trail.** Vercel doesn't log which individual opened a Sharable Link.
- **Still no in-app authentication or authorization**, per the remediation scope — this was
  explicitly deferred to the future platform, and hosting-layer access control (this plan) is
  the intentional compensating control for the pilot period, not a substitute for it long-term.
- **The app itself remains unauthenticated once someone is past the Vercel gate** — anyone who
  has the link can submit vouchers as anyone, per the assessment's existing "Authorization"
  finding. Unchanged by this deployment plan; still acceptable only because Formspree routes to
  test-only recipients per `config.pilot.js`.

---

# Secrets

**There are none to manage.** As documented in `docs/mvp/test-environment.md`, this is a 100%
static client-side app — anything the browser needs is, by construction, visible to the browser.
Nothing is stored in Vercel Environment Variables because there is no build step or server-side
code to consume them.

- `FORMSPREE_ENDPOINT` — a public form-submission URL, not a credential. Safe to commit in
  `config.pilot.js` once it points at a dedicated TEST form.
- `APPROVER_EMAIL_DIRECTORY` (TEST) — not secret, but is personal data; restricted to addresses
  the pilot group controls, per the existing config file's guidance.
- The one thing that must never be committed is a **real** `config.production.js` containing real
  approvers' personal emails — already enforced by `.gitignore` and unaffected by this hosting
  choice.
- No Vercel API tokens, deploy hooks, or CI secrets are required for this manual, dashboard-driven
  deployment approach.

---

# Deployment Steps

**Not executed as part of this task — recorded here as the exact runbook for the next,
deployment-authorized task.**

1. Fill in `mvp/reimbursement-voucher/js/config.pilot.js`: real TEST Formspree endpoint, real
   TEST-safe approver email directory.
2. Run `cd mvp/reimbursement-voucher && node --test` locally — confirm all tests still pass.
3. Create branch `pilot/reimbursement-voucher-test` off `main`; push the current
   `mvp/reimbursement-voucher/` contents (plus the filled-in config from step 1) to it.
4. In Vercel: **New Project** → import the GitHub repo → set Root Directory to
   `mvp/reimbursement-voucher`, Framework Preset `Other`, Build Command empty, Install Command
   empty → deploy from `pilot/reimbursement-voucher-test`.
5. In **Project Settings → Git**, set **Production Branch** to an unused branch name (e.g.
   `vercel-unused-production-branch`) so `pilot/reimbursement-voucher-test` is always treated as
   a Preview deployment.
6. Add `vercel.json` (content above) for the noindex/no-cache headers, commit, redeploy.
7. Open the resulting Preview URL directly in an incognito/private window — confirm it shows the
   Vercel Authentication wall (i.e. confirm it is NOT publicly viewable).
8. From the deployment's **Share** panel, create the one allowed Sharable Link.
9. Verify the Sharable Link works in an incognito window (loads the app, no Vercel login
   prompted).
10. Privately distribute the Sharable Link to the named pilot tester list, along with the Pilot
    Safety Rules below.

---

# Verification Checklist

Before calling the environment "ready for testers," confirm all of the following:

- [ ] `node --test` passes locally (11/11) on the exact commit being deployed.
- [ ] `config.pilot.js` has no remaining `REPLACE_WITH` placeholders.
- [ ] Grep confirms no real personal email addresses anywhere in the deployed directory:
      `grep -rniE "gmail\.com|yahoo\.com|outlook\.com" mvp/reimbursement-voucher/`
- [ ] Visiting the deployed URL logged out / in incognito shows the Vercel Authentication wall,
      **not** the form.
- [ ] Visiting the deployed URL via the Sharable Link shows the form and the amber
      "⚠ TEST ENVIRONMENT" banner at the top.
- [ ] `docs/`, `.ai/`, `adr/`, `specs/` are **not** reachable from the deployed URL (e.g.
      `https://<deployed-url>/docs/mvp/reimbursement-app-assessment.md` 404s) — confirms Root
      Directory scoping is working as expected.
- [ ] Submitting a test voucher end-to-end actually delivers a notification to the intended TEST
      recipient(s) only.
- [ ] Attempting to submit with the placeholder endpoint still in place (dry run before step 1
      above, or by temporarily reverting the config) correctly shows the "test environment is not
      configured" error rather than failing silently.
- [ ] The four approval tiers, including Oceana `> $5,000`, route to the correct approver cards
      when exercised manually in the deployed app (spot-check; automated coverage already exists
      in `tests/approval-rules.test.js`).
- [ ] `X-Robots-Tag: noindex` header present on the response (`curl -sI <url>`).
- [ ] The deployed URL has not been pasted into any public README, issue, or broad Slack channel.

---

# Rollback

Because this is a Preview deployment on a dedicated branch with no custom domain and no
production traffic, rollback is low-risk and fast:

- **Immediately cut off all tester access:** open the deployment's **Share** panel → switch from
  "Anyone with the link" back to "Only people with access." Takes effect immediately; no
  redeploy needed.
- **Revert to a previous working version:** in the Vercel dashboard's Deployments list, select
  any earlier deployment of `pilot/reimbursement-voucher-test` and choose **Redeploy** (or
  **Promote to alias** for that branch) — Vercel keeps every prior deployment addressable.
- **Revert in git:** `git revert` the problematic commit on `pilot/reimbursement-voucher-test`
  and push — triggers a fresh, correct deployment automatically via the Git integration.
- **Full teardown:** delete the Vercel project from the dashboard. This removes all deployment
  URLs immediately; nothing else in the CCF infrastructure is affected since no domain, DNS, or
  external service besides Formspree was ever wired to it.
- **Formspree side:** if a TEST Formspree form was created for this pilot and needs to stop
  accepting submissions, disable or delete it directly in the Formspree dashboard — independent
  of anything on the Vercel side.

---

# Pilot Safety Rules

Restates and cross-references `docs/mvp/test-environment.md`'s deployment prerequisites, now
scoped to hosting-specific rules:

- The Sharable Link is **not public** — do not paste it into any broad or public channel. Send it
  directly to named testers.
- Testers must be told, before first use: this is a **TEST environment**; do not enter real bank
  account details; use clearly fake test data where possible.
- The pilot has an explicit end date (recommended: 1–2 weeks from go-live). At that date, revoke
  the Sharable Link regardless of whether a formal decision on next steps has been made yet.
- If the Sharable Link is ever posted somewhere unintended (public channel, forwarded broadly),
  revoke and regenerate it immediately rather than waiting for the scheduled pilot end.
- No real approver should ever appear in `config.pilot.js`'s `APPROVER_EMAIL_DIRECTORY` — this
  stays true regardless of hosting provider and is unaffected by this plan.
- This deployment must never become, or be pointed to by, a custom/production domain. If CCF
  decides to move forward after the pilot, that is a **new, separate** setup (see below), not an
  in-place promotion of this one.

---

# Production Migration Notes

Not part of this task's scope — recorded so the eventual production decision isn't made from
scratch:

- **Separate Vercel project, not a promotion of this one.** Production should be its own project
  (or its own properly-configured Production Branch + domain on a project dedicated to that
  purpose), so pilot test history/config never intermixes with production.
- **Real domain required first.** Once CCF has a production domain, that's also what unlocks
  **Cloudflare Access** as the recommended access-control upgrade — proper per-person
  authentication (email OTP or SSO), individual revocation, and audit logs, replacing the
  link-sharing model used for this pilot.
- **`config.production.js`** would be created at that point, kept out of git via the existing
  `.gitignore` rule, and injected into the deployment out-of-band (e.g. pasted directly into a
  production-only hosting environment, or reintroduced via a minimal build step if one gets
  added later) — never committed, since it would contain real approvers' personal emails.
- **In-app authentication/authorization** (the CRITICAL gaps intentionally deferred in the
  remediation pass — no login, no real approver sign-off, client-only tier enforcement) must be
  addressed before this stops being "a pilot" in any real sense. That work belongs to the CCF
  Australia Operations Platform (Track B), not a patch on this static file.
- **Formspree** is a reasonable pilot-scale choice but has no server-side validation and a
  submission quota; production should re-evaluate whether it's still the right transport once
  volume/compliance requirements are clearer.
- **If Vercel remains the host for production,** budget for a **Pro** team plan (for actual team
  member collaboration, since Hobby is single-developer-only) and evaluate whether Password
  Protection's $150/month Advanced Deployment Protection add-on is still needed once Cloudflare
  Access is in front of it (likely redundant if Cloudflare Access is the access-control layer).
