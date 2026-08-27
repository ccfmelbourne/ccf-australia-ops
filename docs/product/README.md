# Product Documentation

This folder stores product context and business-aligned documentation for the platform.

## Purpose
Capture product goals, user needs, and finance domain context to keep the engineering work aligned with the business.

## Current contents
- `README.md` — this overview.
- The first real domain content lives in `specs/`, not here yet: `specs/0001-reimbursement-approval-finance-workflow.md` is the confirmed V1 product scope for the Finance domain (reimbursement request → approval → Finance queue), reviewed and confirmed with Finance/leadership. `adr/0001-reimbursement-system-of-record.md` records the product-level principle behind it (the application, not email/PDF, is the system of record).

## Finance domain — V1 at a glance
- Owns: request creation, approval routing, Finance notification, Finance processing queue, audit trail.
- Does not own (deferred, not rejected): Xero integration, bank API, automatic transfer, reconciliation, full accounting ledger.
- See `specs/0001-reimbursement-approval-finance-workflow.md` for the full boundary, confirmed statuses, and the approval-override rules.

The Track A reimbursement pilot (`mvp/reimbursement-voucher/`, `docs/mvp/`) is a separate, temporary artifact that *informs* this product scope (several of the confirmed decisions above originated as pilot tester feedback) but is not itself product documentation and does not define V1 scope on its own.

## Next step
As new domain areas beyond Finance/reimbursement are discovered, add a numbered spec per area under `specs/`, and summarize each here the way the Finance domain is summarized above — keep this file a short index, not a duplicate of the specs themselves.

## References
- Project charter: `.ai/PROJECT.md`
- Architecture overview: `docs/architecture/README.md`
- Development guidance: `docs/development/README.md`
- Specs: `specs/`
- ADRs: `adr/`
