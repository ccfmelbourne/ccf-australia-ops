# 0001. Reimbursement — Request, Approval & Finance Workflow (V1 Boundary)

## Status
Confirmed (2026-08-27) — the workflow boundary, Finance queue statuses, notification channel, and the Regional Director/COS-override rule below have been reviewed and confirmed with Finance/leadership. Remaining implementation details (data model, exact UI) are still to be worked out at build time, but the business rules themselves are settled, not proposals.

## Purpose
Define what V1 of the reimbursement/disbursement workflow does and does not own, so the platform's domain model and architecture can be scoped deliberately rather than growing to cover full accounting integration before it's known to be needed.

This spec addresses the `specs/README.md` TODO: "Add a Finance domain specification for reimbursement and disbursement." It complements `adr/0001-reimbursement-system-of-record.md`, which establishes *why* the application (not email/PDF) is the authoritative record this workflow is built on.

## End-to-end flow

```text
Requester
   │
   ▼
Create reimbursement
   │
   ├── Expenses
   ├── Receipts
   └── Bank details
   │
   ▼
Submit
   │
   ▼
Approval Workflow
   │
   ├── Approver 1
   ├── Approver 2
   └── ...required approvers
   │
   ▼
ALL APPROVED
   │
   ├───────────────┐
   ▼               ▼
Notify Finance     Finance Queue
   │               │
   │               ▼
   │          Accountant logs in
   │               │
   │               ▼
   │          "Ready for Processing"
   │
   └──────► Accountant processes
                    │
                    ▼
              [Outside V1]
              Xero / Banking
```

The required-approvers step (who, and how many, per request) follows the tiered approval rules already piloted in Track A — see `mvp/reimbursement-voucher/js/approval-rules.js` and `docs/mvp/reimbursement-app-assessment.md` for the reference logic and the bug history worth learning from (approver routing must be driven by the field that actually determines the approver group, and covered by automated tests).

## Regional Director approval & COS override for >$5,000 (confirmed)

Originally relayed as unconfirmed Track A pilot tester feedback; confirmed with Finance/
leadership on 2026-08-27:

- For **all** ministry types at the >$5,000 tier (not only Oceana, which is the current Track A
  pilot rule) — approval from the Regional Director (Ptr. Robin Domingo) is required by default.
- That requirement has exactly one alternative path: **unanimous** sign-off from all three named
  COS — **Alex Approver, Jordan Reyes, and Morgan Cruz** — confirming the expense is within the
  approved budget plan. All three must approve; there is no quorum/subset option.
- The override is valid **only if the expense is within budget**. If it is not within budget,
  the override cannot be used and Regional Director approval remains mandatory regardless of
  COS sign-off.
- "Within budget" is determined by the three approvers' own judgement, not a separate budget
  record lookup — their unanimous approval **is** the within-budget confirmation. No budget-plan
  data model or external reference is required for V1.
- The two paths are alternatives, not additive: for any >$5,000 request (any ministry), either
  the Regional Director approves, **or** all three named COS unanimously approve under the
  within-budget condition above. Either path satisfies this part of the Tier 4 requirement,
  alongside the existing 2 COS + Finance Overseer requirement for that request's own ministry
  group.
- Implementation-wise, this still needs an attestation mechanism (e.g. a field/checkbox the
  three named approvers complete) — the *rule* is confirmed, the UI/data model for it is not
  yet designed.

**Explicitly out of scope for now:** the live Track A pilot (`mvp/reimbursement-voucher/`) has
not been updated to reflect this confirmed rule. Per its own remediation scope, the pilot
preserves existing business rules unless the code demonstrates a bug; bringing this confirmed
change into the pilot (so testers exercise the real rule during the remaining test window) is a
separate decision to make explicitly, not something done automatically because Finance/
leadership signed off on the Track B spec.

## Finance queue, not an inbox

The accountant works from an in-app queue, not their email client:

```text
Finance
├── New / Ready for Processing (12)
├── Processing (4)
├── Completed
└── Needs Clarification
```

Opening a reimbursement surfaces everything needed to process it without searching email for a PDF: requester, amount, ministry, expenses, receipts, approval history, bank details, timestamps, comments/history.

### Statuses (confirmed)

| Status | Meaning |
|---|---|
| Ready for Processing | All approvals completed |
| Needs Clarification | Accountant needs information from the requester |
| Processing | Accountant is working on it |
| Processed | Accountant confirms processing complete |
| Rejected/Returned | Something is wrong; sent back |

Confirmed with Finance/leadership on 2026-08-27, including how "Needs Clarification" branches
depending on what's wrong:

- **Missing supporting documentation** (e.g. a missing receipt) — stays a lightweight
  **Needs Clarification** request back to the requester. Processing pauses; it does not need to
  go back through approval again once resolved.
- **Incorrect request details** (e.g. the price/amount is wrong) — this is a substantive change
  to what was approved, so it must go back through the **full approval workflow again**, not
  just a clarification. This is the same principle as the "no silent edits" control below —
  Finance cannot itself change an approved amount or detail.

## Notification, not workflow

Confirmed with Finance/leadership on 2026-08-27: Finance is notified through **both** the in-app
Finance queue and email, with **email as the primary channel**. Per
`adr/0001-reimbursement-system-of-record.md`, email is a notification channel that links back
into the application — it never carries the authoritative data:

> **Reimbursement #RB-2026-00123 is approved and ready for processing.**
>
> Amount: $245.80
> Requester: John Smith
> Ministry: Communications
>
> [Open Reimbursement]

## Control: no silent edits after approval

Once all approvals are complete, Finance may review the reimbursement but must not silently edit the approved amount or details. Any correction needed after approval goes through an explicit **Request Changes** action that returns the item to the requester, rather than an in-place edit. See `adr/0001-reimbursement-system-of-record.md` ("Decision") for the reasoning — an approved amount must stay what the approvers actually approved, or go back through approval again.

## V1 scope boundary

**V1 owns:**
- Request creation (expenses, receipts, bank details)
- Approval workflow (tiered, per the existing pilot rules)
- Finance notification
- Finance queue
- Finance processing status
- Audit trail (request → approval → finance processing, end to end)

**V1 explicitly does not own** (future discovery items, not committed to):
- Xero accounting integration
- Bank API integration
- Automatic bank transfer
- Reconciliation
- Full accounting ledger

These may be pulled into scope later if an accountant interview shows they're valuable — they are deliberately deferred, not rejected.

## Implementation note (non-binding)

This scope does not require a bespoke or heavyweight backend — the reasoning from the source discussion was that it fits within the platform's already-proposed stack (Next.js, TypeScript, Tailwind, Storybook, Zod, Prisma, PostgreSQL) plus object storage for receipts, without needing a separate service or additional language runtime. That stack choice itself is not re-litigated by this spec; if it needs to be formally recorded, it belongs in its own ADR rather than here.

## Confirmation log
- 2026-08-27 — Finance/leadership confirmed: Finance statuses as listed, the Needs
  Clarification vs. re-approval distinction, email as primary notification channel (alongside
  the in-app queue), the Regional Director requirement extending to all ministries at >$5,000,
  and the 3-COS unanimous within-budget override rule. All open questions from the original
  draft of this spec are resolved by the above; none remain outstanding.
- Not yet decided: whether to bring the confirmed Regional Director/COS-override rule into the
  live Track A pilot during its remaining test window, or leave the pilot as-is and let this
  rule apply only once Track B is built.

## References
- `adr/0001-reimbursement-system-of-record.md`
- `docs/mvp/reimbursement-app-assessment.md`
- `mvp/reimbursement-voucher/` (Track A pilot — informs but does not define V1 scope)
- `.ai/PROJECT.md`
