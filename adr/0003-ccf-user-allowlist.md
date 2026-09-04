# 0003. Google Sign-In Only Grants Access to Pre-Provisioned CCF Users

## Status
Accepted (2026-09-04) — confirmed directly with the decision-maker, closing a real gap found in
the deployed app: any Google account could sign in and get a working session.

## Context
CCF Australia's real users sign in with personal Gmail addresses, not a Google Workspace domain — there is
no `@ccf...` domain to restrict sign-in to, and a naive check like `email.endsWith("@gmail.com")`
would let essentially anyone in. Before this decision, `src/app/api/auth/google/callback/route.ts`
did an unconditional `prisma.user.upsert(...)` on every successful Google sign-in: literally any
Google account, CCF-affiliated or not, could sign in and immediately get a working requester
session, since `User` had no concept of account status at all. By the time this was found, 46 real
`User` rows already existed from ordinary use — this wasn't a hypothetical risk.

## Decision
Split "who are you" from "are you allowed in" into two separate, independently-reasoned-about
layers:

```text
1. Authentication          2. Platform access           3. Authorization
   "Who are you?"             "Are you an authorised        "What can you do?"
        │                      CCF user?"                        │
        ▼                          │                              ▼
   Google OAuth                    ▼                       Roles / permissions
   (unchanged)              User.status (this ADR)         (ApproverAssignment,
                             ACTIVE / SUSPENDED             COS_POOL -- unchanged)
```

Google OAuth still establishes identity exactly as before. A new `User.status` field
(`ACTIVE`/`SUSPENDED`) decides whether that identity is allowed to actually use the platform:

- **No code path creates a `User` row from sign-in anymore.** The Google callback route now only
  looks up an existing row by email; if none exists, or it isn't `ACTIVE`, sign-in is denied with
  a single generic message ("Access denied — your account isn't authorised") that doesn't reveal
  whether the email was never registered or was suspended. Provisioning a new user is a deliberate
  admin action (`prisma/seed.ts`/`prisma/seed-data.json`, or Prisma Studio) — no self-service
  registration, no register button, no invite-email flow, deliberately, for now.
- **Status is re-checked on every subsequent authenticated request, not just at sign-in** —
  `getCurrentActiveUserId()` (`src/lib/user-session.ts`) wraps the existing cookie-only
  `getCurrentUserId()` with a live `status` lookup, used by the `(app)` layout (every page) and
  every request/approval Server Action. Suspending someone takes effect immediately, even if they
  already hold a valid 30-day session cookie — it isn't a lock that only applies at next sign-in.
- **The column defaults to `SUSPENDED` for anything created going forward**, so a future code path
  that creates a `User` row without thinking carefully about status fails closed, not open — the
  same class of gap this decision closes. The one-time migration that added the column explicitly
  backfilled every pre-existing row (the 9 named approvers plus the 46 real accounts already in
  use) to `ACTIVE`, so nobody already legitimately using the app was locked out by this change.

## Consequences

**Positive**
- Closes a real, already-exploited-by-ordinary-use access gap without needing a Workspace domain
  CCF doesn't have.
- Revoking someone's access (they leave the ministry, etc.) is a one-field change with immediate
  effect — no need to touch their actual Google account.
- Cheap to check: the layout's status lookup reuses a query it was already making
  (`getUserProfile`); Server Actions each add one small `findUnique`, consistent with this app's
  existing per-request-query posture (no caching layer anywhere else either).

**Negative / trade-offs**
- A brand-new legitimate requester (anyone who isn't already a named approver) must be manually
  added as a `User` row before their first sign-in — there's no self-service path yet. For a small,
  known-membership platform this is an acceptable, explicitly chosen trade-off; it would need
  revisiting (a real admin UI, or an invite flow) if CCF Australia's real user base grows large enough that
  manual provisioning becomes the bottleneck.
- No first-class "who added this person, when, why" audit trail beyond whatever the provisioning
  mechanism itself records (a seed-data commit, or direct DB access) — acceptable for now, given
  the deliberately small and infrequent set of provisioning events.

## Related
- `prisma/schema.prisma` — the `UserStatus` enum and `User.status` field.
- `src/app/api/auth/google/callback/route.ts`, `src/lib/user-session.ts` — the enforcement points.
- `adr/0002-platform-architecture.md` — the broader stack/structure this decision sits inside.
