# 0001. The Application Is the System of Record for Reimbursements; Email Is Notification Only

## Status
Proposed — captured from an architecture discussion on the V1 platform boundary. Not yet reviewed with Finance/accounting stakeholders per the project charter's stakeholder-alignment expectation.

## Context
The reimbursement MVP pilot (Track A, `mvp/reimbursement-voucher/`) follows the pattern the manual process already used: a form generates a PDF, the PDF is emailed, and the accountant works from whatever is in their inbox.

```text
Application
   ↓
PDF
   ↓
Email
   ↓
Accountant
```

This is fine for a short, disposable pilot, but it is not a pattern we want to carry into the real Operations Platform (Track B): once email is the place the data actually lives, there is no single authoritative record of a reimbursement's current state, no reliable audit trail across approvals, and no way to query or report on the set of requests as a whole — findings already surfaced independently in the pilot's own deployment-readiness assessment (`docs/mvp/reimbursement-app-assessment.md`, "Data persistence").

## Decision
The platform's database is the system of record for reimbursement requests, their expenses/receipts, and their approval history. Email is a **notification channel only** — it tells a human that something needs their attention and links back into the application; it never carries the authoritative data.

```text
Application
   ↓
Reimbursement record
   ↓
All approvals completed
   ↓
Finance queue
   ↓
Email notification ──────► Accountant
   │
   ▼
Accountant opens application
```

A concrete consequence of this: once a reimbursement has completed approval, Finance may **review** it but must not **silently edit** the approved amount or details. Any change required after approval goes through an explicit "Request Changes" action that returns the item to the requester, rather than the accountant editing the approved record directly. Silent edits would let an approved amount change after the approvers signed off on a different figure — a control gap, not just a UX preference.

```text
Requester submits $500
       ↓
Approvers approve $500
       ↓
Accountant changes it to $750   ← not allowed
       ↓
$750 gets paid                  ← without approver sign-off on $750
```

## Consequences

**Positive**
- A single, queryable, auditable record of every reimbursement and its full approval history.
- Finance gets a purpose-built queue (see `specs/0001-reimbursement-approval-finance-workflow.md`) instead of triaging PDFs out of an inbox.
- Approval integrity is preserved — what was approved is what gets paid, or it goes back through the workflow.

**Negative / trade-offs**
- Requires building and maintaining the reimbursement/approval/finance-queue data model and UI in the real platform — meaningfully more work than "generate PDF, send email," and explicitly out of scope for the Track A pilot, which intentionally keeps that pattern for now.
- Email still needs to exist as a reliable notification mechanism (delivery, templating), even though it's no longer the source of truth — it's a dependency, just a smaller one.

## Related
- `specs/0001-reimbursement-approval-finance-workflow.md` — the V1 workflow boundary this decision shapes.
- `docs/mvp/reimbursement-app-assessment.md` — pilot findings that motivated this (see "Data persistence", "Approval logic").
- `.ai/PROJECT.md` — project charter (Finance domain, V1 scope).
