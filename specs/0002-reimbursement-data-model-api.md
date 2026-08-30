# 0002. Reimbursement — Data Model & API Contract Sketch

## Status
Draft — a concrete, illustrative pass at the data model and API shape implied by
`specs/0001-reimbursement-approval-finance-workflow.md` and `adr/0002-platform-architecture.md`
(Prisma/PostgreSQL). This is documentation, not implementation: the Prisma-flavored schema below
is a starting point for whoever writes the real `schema.prisma`, not a file to copy verbatim.
Partially validated against a real implementation attempt (Finance V1 slice 1 — see
"Validated against slice 1" below); the request-creation/approval-routing half of this sketch
remains unvalidated, since slice 1 starts from an already-approved request.

## Purpose
Go one level more concrete than spec 0001 — from workflow/business rules to the actual
entities, relationships, and operations — so implementation can start from a shared shape
instead of everyone inventing their own model of "what a reimbursement even is" in code.

## Entity overview

```text
User ──────────────┬──────────────────────────────┐
                    │                              │
                    ▼                              ▼
           ReimbursementRequest ──┬── LineItem
                    │             ├── Receipt
                    │             ├── BankDetails (1:1)
                    │             └── AuditLogEntry (many)
                    │
                    ▼
           RequiredApproval (many) ── approverUserId → User
                    │
                    ▼
           RegionalDirectorOverride (0:1, tier 4 only)
                    │
                    ▼
           OverrideApproval (exactly 3, fixed approvers)
```

- **User** — every person the system knows about: requesters, approvers, Finance staff. One
  table, not separate "Approver"/"Requester" tables — the same person can be a requester on one
  request and an approver on another.
- **ReimbursementRequest** — the aggregate root. One row per voucher.
- **LineItem** — expense lines (description + amount) belonging to a request.
- **Receipt** — uploaded file reference per request (object storage — see ADR 0002).
- **BankDetails** — one-to-one with a request. Sensitive; see "Sensitive data" below.
- **RequiredApproval** — one row per approver role required for a given request (Ministry
  Overseer, COS1, COS2, Finance Overseer, Regional Director), generated at submission time from
  the tier + ministry-group rules already piloted and tested in
  `mvp/reimbursement-voucher/js/approval-rules.js`.
- **RegionalDirectorOverride** / **OverrideApproval** — the confirmed >$5,000 override path
  (Ross Callado, Joel Jerez, Vamie Pinlac unanimous, within-budget only) — see "Approval branching"
  below for why this needs its own model rather than fitting into `RequiredApproval` directly.
- **AuditLogEntry** — append-only record of every state-changing action on a request, satisfying
  spec 0001's audit trail requirement.

## Prisma schema sketch

```prisma
enum RequestType {
  CASH_ADVANCE
  REIMBURSEMENT
  LIQUIDATION_OF_CASH_ADVANCE
  BENEVOLENCE
  PAYMENT_TO_SUPPLIER
  STATE_INTERNATIONAL_TRANSFER
}

// Mirrors the 10 "Ministry Type" values from the Track A pilot, which map to 5 approval
// groups (admin, finance, b1g, comms, oceana) — see approval-rules.js's
// MINISTRY_TYPE_TO_APPROVAL_GROUP for the exact mapping to carry over.
enum MinistryType {
  ADMIN
  EXALT_LIVE_PROD
  FINANCE
  NXTGEN
  PASTORAL_CARE
  B1G
  ELEVATE
  EVENTS_HOST
  COMMS_MEDIA_DGM
  OCEANA_REGIONAL
}

enum RequestStatus {
  DRAFT
  SUBMITTED
  IN_APPROVAL
  APPROVED
  READY_FOR_PROCESSING
  NEEDS_CLARIFICATION
  PROCESSING
  PROCESSED
  REJECTED_RETURNED
}

enum ApproverRole {
  MINISTRY_OVERSEER
  COS1
  COS2
  FINANCE_OVERSEER
  REGIONAL_DIRECTOR
}

enum ApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}

model User {
  id                String   @id @default(cuid())
  name              String
  email             String   @unique
  createdAt         DateTime @default(now())

  requests          ReimbursementRequest[] @relation("Requester")
  approvals         RequiredApproval[]
  overrideApprovals OverrideApproval[]
  auditEntries      AuditLogEntry[]
}

model ReimbursementRequest {
  id             String        @id @default(cuid())
  voucherNo      String        @unique // see "Voucher numbering" below — NOT Math.random()
  requestType    RequestType
  ministryType   MinistryType
  requesterId    String
  requester      User          @relation("Requester", fields: [requesterId], references: [id])
  totalAmount    Decimal       // denormalized sum of line items, kept in sync on write
  status         RequestStatus @default(DRAFT)
  submittedAt    DateTime?
  createdAt      DateTime      @default(now())
  updatedAt      DateTime      @updatedAt

  lineItems           LineItem[]
  receipts            Receipt[]
  bankDetails         BankDetails?
  requiredApprovals   RequiredApproval[]
  regionalOverride    RegionalDirectorOverride?
  auditLog            AuditLogEntry[]
}

model LineItem {
  id                     String               @id @default(cuid())
  reimbursementRequestId String
  request                ReimbursementRequest @relation(fields: [reimbursementRequestId], references: [id])
  description            String
  amount                 Decimal
}

model Receipt {
  id                     String               @id @default(cuid())
  reimbursementRequestId String
  request                ReimbursementRequest @relation(fields: [reimbursementRequestId], references: [id])
  storageKey             String               // object storage reference (Cloudflare R2 — ADR 0002)
  uploadedAt             DateTime             @default(now())
}

// One-to-one, kept as its own table (not columns on ReimbursementRequest) so it can be
// access-restricted / encrypted independently — see "Sensitive data" below.
model BankDetails {
  id                     String               @id @default(cuid())
  reimbursementRequestId String               @unique
  request                ReimbursementRequest @relation(fields: [reimbursementRequestId], references: [id])
  accountName            String
  bsb                    String
  accountNumber          String
}

model RequiredApproval {
  id                     String               @id @default(cuid())
  reimbursementRequestId String
  request                ReimbursementRequest @relation(fields: [reimbursementRequestId], references: [id])
  role                   ApproverRole
  approverUserId         String?              // nullable until the routed approver is resolved
  approver               User?                @relation(fields: [approverUserId], references: [id])
  status                 ApprovalStatus       @default(PENDING)
  decidedAt              DateTime?
  comments               String?

  @@unique([reimbursementRequestId, role])
}

// Only created for tier-4 (>$5,000) requests where the requester/Finance chooses to pursue
// the COS-override path instead of routing to the Regional Director directly.
model RegionalDirectorOverride {
  id                     String               @id @default(cuid())
  reimbursementRequestId String               @unique
  request                ReimbursementRequest @relation(fields: [reimbursementRequestId], references: [id])
  withinBudget           Boolean              @default(false) // becomes true only once all 3 approve
  createdAt              DateTime             @default(now())

  approvals              OverrideApproval[]
}

// Exactly three rows expected per override, one each for Ross Callado, Joel Jerez, and
// Vamie Pinlac specifically — not "any 3 COS." Enforce the fixed-identity constraint in
// application logic (Prisma alone won't express "must be exactly these 3 users").
model OverrideApproval {
  id            String                    @id @default(cuid())
  overrideId    String
  override      RegionalDirectorOverride  @relation(fields: [overrideId], references: [id])
  approverUserId String
  approver      User                      @relation(fields: [approverUserId], references: [id])
  approved      Boolean                   @default(false)
  decidedAt     DateTime?

  @@unique([overrideId, approverUserId])
}

model AuditLogEntry {
  id                     String               @id @default(cuid())
  reimbursementRequestId String
  request                ReimbursementRequest @relation(fields: [reimbursementRequestId], references: [id])
  actorUserId            String
  actor                  User                 @relation(fields: [actorUserId], references: [id])
  action                 String               // e.g. "SUBMITTED", "APPROVED", "REQUESTED_CHANGES"
  details                Json?
  createdAt              DateTime             @default(now())
}
```

## Approval branching (why this isn't just a flat checklist)

Per spec 0001, a tier-4 (>$5,000) request needs: **2 COS + Finance Overseer (from the request's
own ministry group)**, **AND** one of two alternatives:

- Regional Director (Ptr. Ryan Escobar) approves directly, **or**
- All three named COS (Ross Callado, Joel Jerez, Vamie Pinlac) unanimously approve the override,
  conditioned on the request being within the approved budget plan.

This is a genuine **OR** in the requirement, not just a longer checklist — `RequiredApproval`
rows model an implicit AND (every row must reach `APPROVED`), so the Regional-Director-or-
override branch is deliberately modeled as a separate `RegionalDirectorOverride` +
`OverrideApproval` pair rather than forced into the same flat list. Application logic (not the
schema) is what decides "tier-4 approval is satisfied" — that decision function should live in
one place, mirroring how `approval-rules.js` already centralizes the tier/routing logic in the
Track A pilot, and should be unit tested the same way that file is.

## API / action contract (illustrative, not a full OpenAPI spec)

**TODO (not yet updated):** the Finance-driven rows below (`markNeedsClarification`,
`requestChanges`, `markProcessing`/`markProcessed`) predate the confirmed decision that Finance no
longer logs into the app at all — see the "Finance Retires From the App" phase transition in
`.ai/WORKLOG.md`. Once full approval instead triggers an automated email to Finance with the
rendered form + receipts + bank details, this table (and the `RequestStatus` values it implies)
needs revising to match — not done yet, since the submit/approval-routing action that would
trigger it doesn't exist yet either.

| Action | Who | Effect |
|---|---|---|
| `createRequest` | Requester | New `DRAFT` request |
| `addLineItem` / `removeLineItem` | Requester | Mutates line items on a `DRAFT` request |
| `uploadReceipt` | Requester | Attaches a receipt to a `DRAFT` request |
| `submitRequest` | Requester | `DRAFT` → `SUBMITTED`/`IN_APPROVAL`; generates `RequiredApproval` rows from tier + ministry group |
| `approve` / `reject` | Assigned approver | Updates their `RequiredApproval` row; when all rows (and the override branch, if applicable) resolve, request → `APPROVED` → `READY_FOR_PROCESSING` |
| `requestOverride` | Requester or Finance | Creates `RegionalDirectorOverride` + 3 `OverrideApproval` rows for the named COS |
| `overrideApprove` | One of the 3 named COS | Marks their `OverrideApproval` row; when all 3 are true, `withinBudget` flips true and satisfies the tier-4 alternative |
| `markNeedsClarification` | Finance | `READY_FOR_PROCESSING`/`PROCESSING` → `NEEDS_CLARIFICATION` — for missing documentation only (see spec 0001); does not reopen approval |
| `requestChanges` | Finance | Returns an approved request to the requester for substantive changes (e.g. wrong amount) — **not** a silent edit, per ADR 0001; re-enters the full approval workflow after resubmission |
| `markProcessing` / `markProcessed` | Finance | Advances Finance's own status |
| `rejectReturn` | Any required approver, or Finance | → `REJECTED_RETURNED` |

Every action above writes an `AuditLogEntry`.

## Sensitive data

`BankDetails` holds account name, BSB, and account number — the same data the pilot's own
assessment (`docs/mvp/reimbursement-app-assessment.md`) flagged as CRITICAL when mishandled.
For the real platform: keep it in its own table (as modeled) so field- or table-level
encryption-at-rest and tighter access control can be applied independently of the rest of the
request, and restrict read access to Finance + the requester themselves, not every approver in
the chain (an approver needs to know the *amount*, not the *account number*, to do their job).

## Voucher numbering

The Track A pilot generates voucher numbers with `Math.random()` (see assessment finding #7) —
explicitly **not** acceptable for the real platform, since it isn't collision-resistant and
isn't backed by any authority. The real platform needs an atomic, database-backed sequence
(e.g. a Postgres sequence, or a serialized counter row with a transaction) to guarantee
uniqueness under concurrent submissions.

## Validated against slice 1

Finance V1 slice 1 (`platform/prisma/schema.prisma`) implemented the `User`,
`ReimbursementRequest`, `LineItem`, `Receipt`, `RequiredApproval`, and `AuditLogEntry` models
essentially as sketched, confirming the shape holds up under a real Prisma/PostgreSQL
implementation. Differences worth folding back in:

- `BankDetails` implemented as sketched (slice 8, 2026-08-30) — same field names, kept as its own
  1:1 table. One change: since Finance no longer logs into the app at all (see the "Finance
  Retires From the App" phase transition in `.ai/WORKLOG.md`), there's no Finance-side read view
  to restrict access on — bank details are owner-only until the future submit+approval+email
  slice reads them server-side to build the email to Finance. Encryption-at-rest is an explicit
  TODO (see `platform/prisma/schema.prisma`'s comment), not yet built — relying on Neon's
  standard disk-level encryption for now.
- `RegionalDirectorOverride`/`OverrideApproval` remain deferred, not disproven — no submit/
  approval-routing action exists yet, so there's nothing to validate them against.
- `Decimal` fields (`totalAmount`, `LineItem.amount`) needed explicit precision —
  `@db.Decimal(12, 2)` — which this sketch's `Decimal` didn't specify. Carry that precision
  forward into any future model using money amounts.
- Prisma 7 requires an explicit `generator` block with `provider = "prisma-client"` and a custom
  `output` path (this sketch didn't show a `generator` block at all, since it predates that
  requirement being confirmed).
- The role/assignment open question below got a partial, practical answer for the Finance side in
  slice 1 (a single env-configured Finance identity lazily upserted into `User` by email) — since
  superseded: the Finance login/queue system this supported was removed entirely in slice 8, once
  the decision-maker confirmed Finance no longer interacts with the app at all (see the "Finance
  Retires From the App" phase transition in `.ai/WORKLOG.md`). It does not resolve how *approver*
  role assignment (Ministry Overseer/COS1/COS2/Finance Overseer per ministry group) should be
  modeled once request submission/routing exists — that part of the open question below is still
  open.

## Open questions
- Should `User` carry role/permission data directly, or is that a separate
  `MinistryApproverAssignment`-style table (who currently holds Ministry Overseer/COS1/COS2/
  Finance Overseer for each ministry group)? The pilot's `APPROVERS_BY_MINISTRY` reference table
  is the starting data either way — this is about where it lives, not what it contains.
- Multi-ministry-group membership: can one person hold a named role in more than one group at
  once (the pilot's reference data doesn't show it today, but doesn't rule it out structurally)?
- Receipt handling: virus/malware scanning on upload, accepted file types/size limits — still not
  addressed. Slice 1 only *displays* receipts (`RequestDetailView`) via a seeded `storageKey`;
  there is no upload UI or upload action yet in the implementation to validate this against.
- Does "Area" (the physical location field — Bendigo/Geelong/South East/Tottenham) need to be
  modeled at all beyond an informational string, given it doesn't drive approval routing?

## References
- `specs/0001-reimbursement-approval-finance-workflow.md`
- `adr/0001-reimbursement-system-of-record.md`
- `adr/0002-platform-architecture.md`
- `mvp/reimbursement-voucher/js/approval-rules.js` — the tested reference logic for tier/routing
- `docs/mvp/reimbursement-app-assessment.md` — sensitive-data and voucher-numbering findings this sketch carries forward
