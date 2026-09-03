---
name: Security & Privacy
description: Use for any change touching bank account details, receipts/uploaded files, reimbursement amounts, approval decisions, personal information, or authorization/access control. Use before adding a new Server Action or data-access function that reads or writes anything sensitive. Ask the four questions below for any new financial or approval workflow.
---

# Security & Privacy

This platform handles bank account details, receipts, reimbursement amounts, personal
information, and approval records. Treat all of it as sensitive by default.

## The four questions for any financial/approval workflow
1. Who is allowed to see this?
2. Who is allowed to change this?
3. Who is allowed to approve this?
4. What happens if this user manipulates the request (edits a query param, replays a request,
   claims a role they don't have)?

## Rules

1. **Never expose sensitive data unnecessarily.** `getPendingApprovalsForUser`
   (`src/lib/approval-data.ts`) deliberately omits bank details from its return shape — an
   approver never needs them to decide, per spec 0002's explicit access restriction. Follow this
   pattern: shape a query's return type to what the caller actually needs, not "everything, in
   case."
2. **Authorization must be enforced server-side. Never rely on UI visibility as authorization.**
   Every signed-in page fetches `getCurrentUserId()` and redirects if absent — the *data
   functions themselves* re-check the requester/approver ID against the row being touched,
   they don't trust the caller to have already checked. See the next rule for a concrete example
   of exactly this kind of server-side check.
3. **Requesters must not be able to approve their own requests, unless an explicitly documented
   business rule allows automatic satisfaction.** This is already enforced two ways in this
   codebase, and any new approval logic should match both: `approval-data.ts` filters a user's
   own request out of their own pending-approvals list server-side (`if (a.request.requesterId
   === userId) return false`) — not just hidden in the UI; and the one real exception (a
   requester who happens to hold the exact role their own request needs) is a distinct,
   auditable `AUTO_SATISFIED` status, never a normal `APPROVED` decision the requester clicked
   themselves. A new "requester can also be the approver" scenario needs the same two things:
   a server-side filter, and if satisfaction should be automatic, a distinct status that makes
   it visible in the audit trail as auto-satisfied rather than indistinguishable from a real
   decision.
4. **Never expose bank details to users who shouldn't see them** (see rule 1).
5. **Avoid storing sensitive data in `localStorage`/`sessionStorage`** unless explicitly
   justified — session identity is a signed, httpOnly cookie (`src/lib/user-session.ts`), not
   client-readable storage.
6. **Validate all user input server-side**, even when a client component already validates it.
7. **Protect against XSS, injection, CSRF, and unsafe file handling.** Prisma's query builder
   avoids raw SQL injection by construction — don't drop to raw SQL without the same
   parameterization discipline.
8. **Treat uploaded receipts as untrusted files.** Validate type, size, and content before
   storage — see `assertValidReceiptFile` and `assertNotAnimatedPng` (animated PNGs are rejected
   even though they pass a basic content-type check, since they aren't a legitimate receipt
   format) in the receipt-upload path as the existing pattern to extend, not just reference.
9. **Never log bank details, credentials, tokens, or other sensitive data.** If a debug log
   needs to reference a sensitive record, log its ID, not its contents.
10. **Secrets belong in environment variables**, never committed. `APP_SESSION_SECRET` and the
    Google OAuth credentials are the existing pattern (`.env.example` documents what's required
    without the real values).
11. **Never commit credentials or secrets.**
12. **Security-sensitive business rules need automated tests.** The approval-routing tier logic
    (`getTier`, `getRequiredApproverRoles` in `approval-routing.ts`) and file-validation
    functions are pure and directly tested via `node --test` — keep new authorization/business
    rules similarly pure and testable, not buried inside a Server Action where they can only be
    exercised through a full request.

## A real, already-handled example worth knowing about
`COS_POOL` (`approval-routing.ts`) contains real people's personal email addresses. A synthetic
dev-only identity is appended to that pool only when `NODE_ENV !== "production"`, and is further
scoped (in `approval-data.ts`) to only ever act on a matching synthetic test requester's own
requests — not any real pending approval in the shared database. When adding a dev/test bypass
for anything security- or identity-related, match this shape: gate it on environment, and scope
it narrowly enough that it can't reach real data even if someone signs in as the test identity in
a shared environment by mistake.
