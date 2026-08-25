# 0001. Reimbursement — Request, Approval & Finance Workflow (V1 Boundary)

## Status
Draft — captured from an architecture discussion defining the V1 scope for Track B (the Operations Platform). Not yet confirmed with the Finance/accounting team; several details below are explicitly marked as needing that confirmation.

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

## Proposed refinement: Regional Director override for >$5,000 (pilot feedback — unconfirmed)

Feedback relayed from a Track A pilot tester, not yet confirmed with Finance/leadership:

- For **all** ministry types at the >$5,000 tier (not only Oceana, which is the current Track A
  pilot rule), approval from the Regional Director (Ptr. Ryan Escobar) is required by default.
- That requirement can be **overridden** if the three named COS — **Ross Callado, Joel Jerez,
  and Vamie Pinlac** — all approve *and* attest that the expense is already part of an approved
  budget plan. When overridden, Regional Director approval is not required.
- The attestation is a real control point, not a UI nicety: proposed as a new field/checkbox
  these three specific approvers complete to confirm "already part of the approved budget plan"
  before the override takes effect.

This is a genuine widening of the control (Regional Director now applies platform-wide at Tier
4, not just Oceana) paired with a genuine bypass path (the 3-COS attestation), so it should be
confirmed with Finance/leadership before being built, not implemented from a single secondhand
report alone.

**Open questions before this is implementable:**
- Why these three specific COS (Admin, Finance, B1G) and not also Dexter Santiago (Comms COS1)
  or Ptr. Ryan Escobar's own Oceana COS1 role — intentional, or an artifact of how the feedback
  was phrased?
- Does the override require all three, or a subset/quorum?
- Is "already part of the approved budget plan" just an attestation (trust the three COS), or
  does it need to reference an actual budget record — which would imply a budget-plan data
  model this spec doesn't currently define?
- Does this replace Regional Director approval entirely for that request, or route it as an
  additional optional path alongside it?

**Explicitly out of scope for now:** the live Track A pilot (`mvp/reimbursement-voucher/`) is
not being changed to reflect this. Per its own remediation scope, the pilot preserves existing
business rules unless the code demonstrates a bug — a rule *change* like this belongs in Track B
design, confirmed with the actual decision-makers, not patched into a temporary pilot from one
tester's relayed feedback.

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

### Proposed statuses (needs confirmation with the accountant)

| Status | Meaning |
|---|---|
| Ready for Processing | All approvals completed |
| Needs Clarification | Accountant needs information from the requester |
| Processing | Accountant is working on it |
| Processed | Accountant confirms processing complete |
| Rejected/Returned | Something is wrong; sent back |

These exact status names and transitions are a starting proposal, not a locked decision — confirm the real accounting workflow with the accountant before building against them.

## Notification, not workflow

Per `adr/0001-reimbursement-system-of-record.md`, email is a notification channel that links back into the application — it never carries the authoritative data:

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

## Open questions
- Confirm the Finance status names/transitions above with the accountant.
- Confirm notification channel(s) beyond email (in-app only vs. email + in-app, per the source discussion's preference for in-app as primary).
- Define what "Needs Clarification" actually requires from the requester, and whether that reopens approval or not.

## References
- `adr/0001-reimbursement-system-of-record.md`
- `docs/mvp/reimbursement-app-assessment.md`
- `mvp/reimbursement-voucher/` (Track A pilot — informs but does not define V1 scope)
- `.ai/PROJECT.md`
