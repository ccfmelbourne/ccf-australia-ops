# Engineering Worklog

## Purpose
Capture key decisions, progress, and open items for the repository foundation.

## Sections
- `Notes` — working context and discoveries.
- `Decisions` — approved repository-level decisions.
- `Open items` — TODO items and unresolved decisions.

## Notes
- Foundation phase only; no application code.
- Documentation should be brief and cross-referenced.

## Decisions
- Repository structure includes `.ai`, `docs/`, `adr/`, `specs/`, and `.github/`.
- AI guidance and project charter are stored under `.ai/`.
- README functions as a navigation hub with links to core docs.
- ADR 0001: the reimbursement application (not email/PDF) is the system of record for
  reimbursements and their approval history; email is a notification channel only. See
  `adr/0001-reimbursement-system-of-record.md`.
- Spec 0001: V1 scope boundary for the reimbursement request → approval → Finance queue
  workflow, explicitly excluding Xero/bank integration for V1. See
  `specs/0001-reimbursement-approval-finance-workflow.md`. Draft — Finance queue statuses still
  need accountant confirmation.

## Open items
- TODO: Define `.github/` files and workflows.
- TODO: Create an ADR for the overall platform architecture and repository structure (ADR 0001
  covers the reimbursement system-of-record decision specifically, not the platform as a whole).
- TODO: Add product and development README content.
- TODO: Confirm Finance queue statuses and notification approach with the accountant (see
  spec 0001's "Open questions").
