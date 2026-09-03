---
name: Database & Data Access
description: Use when writing or changing a Prisma query, adding a migration, touching multiple related tables in one operation, or deciding where a new data-access function belongs. Use when a change affects financial or approval state transitions, since those need to stay traceable.
---

# Database & Data Access

## Stack
PostgreSQL (managed, Neon) via Prisma, per `adr/0002-platform-architecture.md`. Schema validation
is Zod at the boundary where raw input arrives (see `platform/src/app/requests/actions.ts` for
the existing pattern) — not re-validated ad hoc at every internal call site.

## Rules

1. **Keep domain ownership clear.** A query touching `ReimbursementRequest`/`LineItem`/`Receipt`
   belongs in `request-data.ts`; one touching `RequiredApproval` decisions belongs in
   `approval-data.ts`. See `architecture-domain-boundaries` for the full module map.
2. **Use migrations** (`prisma/migrations/`) for every schema change — never a manual `ALTER
   TABLE` against the real database.
3. **Maintain referential integrity.** Cascading deletes are explicit in the schema (a deleted
   `ReimbursementRequest` cascades its `LineItem`/`Receipt`/`RequiredApproval`/`AuditLogEntry`
   rows) — new relations should decide cascade behavior deliberately, not leave it to whatever
   Prisma defaults to.
4. **Prefer explicit schemas/types.** Prisma's generated client types plus the exported `*View`
   interfaces (`RequestListItemView`, `PendingApprovalView`, etc.) are the existing pattern for
   shaping what a query returns — don't return a raw Prisma model where a narrower, purpose-built
   shape is clearer and avoids leaking fields the caller shouldn't see (see `security-privacy` on
   why `PendingApprovalView` omits bank details).
5. **Validate data at the appropriate boundary** — Zod at the Server Action/input boundary, not
   scattered re-validation of already-trusted internal data.
6. **Avoid duplicated sources of truth.** A value derived from other stored data (e.g. a
   request's total amount from its line items) should be computed from the real rows, not kept as
   a second, separately-maintained field that can drift.
7. **Do not denormalize prematurely.** Add a derived/cached column only when a real, measured
   query cost justifies it — not speculatively.
8. **Use transactions when multiple related writes must succeed together.** This codebase uses
   the **array-form** `prisma.$transaction([...])` throughout, deliberately not the interactive
   callback form (`prisma.$transaction(async (tx) => {...})`) — a second interactive transaction
   issued shortly after a first one was found to silently fail to persist its writes against this
   exact stack (Prisma 7 + `@prisma/adapter-pg` + Next.js dev server, tested against Neon), with
   no thrown error and no log. Array-form transactions didn't exhibit this. Match the array form
   for new multi-write operations rather than reintroducing the callback form.
9. **Financial and approval state transitions must be handled carefully.** `RequiredApproval`
   status transitions (`PENDING` → `APPROVED`/`REJECTED`/`AUTO_SATISFIED`) and
   `ReimbursementRequest` status transitions are the platform's core correctness surface — any
   change here needs a test, not just manual verification (see `testing-qa`).
10. **Sensitive data access should be explicitly authorized** — see `security-privacy`'s rules on
    server-side authorization; this applies at the query layer too (scope `where` clauses to the
    authorized user/role, don't filter sensitive rows out only after fetching them).
11. **Queries should retrieve only the data actually needed.** Use `select`/`include` to shape
    the query, not fetch-everything-then-filter-in-JS.

## Auditability
`AuditLogEntry` (`prisma/schema.prisma`) is the system-of-record audit trail for status changes,
per `adr/0001-reimbursement-system-of-record.md` — the application, not email or a generated PDF,
is the authoritative record. Any new state transition on a `ReimbursementRequest` or
`RequiredApproval` that matters for auditing should write an `AuditLogEntry` row in the same
transaction as the state change, not as an afterthought that could fail independently.
