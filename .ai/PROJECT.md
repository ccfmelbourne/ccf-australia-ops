# Project Charter

## Project Purpose
Create an internal Operations Platform for CCF Australia that replaces the current manual reimbursement and disbursement workflow. Version 1 will enable Finance to move from ad hoc, error-prone processes to a consistent, auditable, and scalable operations system.

## Vision
A reliable, modular operations platform that empowers Finance and future operational teams with transparent workflows, fast execution, and low-friction collaboration across CCF Australia.

## Mission
Deliver a maintainable, documentation-driven Finance module first, then expand the same platform to support additional operations modules with minimal rework.

## Engineering Philosophy
- Documentation first, then design, then implementation.
- Build around clear domain models and bounded contexts.
- Keep the core architecture simple, maintainable, and extensible.
- Prefer predictable, proven technology over novelty.
- Structure the repo so teams can contribute safely and consistently.
- Use tests and specifications where they provide the most value.
- Treat reusable UI as first-class work through Storybook or equivalent design system artifacts.

## Phase Transition: Foundation → Finance V1 Implementation (2026-08-27)

The foundation phase (Scope, below) is complete for the Finance domain: charter approved,
domain discovery done (`specs/0001-reimbursement-approval-finance-workflow.md`, confirmed with
Finance/leadership), architecture decided (`adr/0001-reimbursement-system-of-record.md`,
`adr/0002-platform-architecture.md`, both Accepted), and a data model sketch exists
(`specs/0002-reimbursement-data-model-api.md`). Effective this date, **Finance V1
implementation begins** — this repository is no longer foundation-documentation-only for the
Finance domain specifically (other future domains remain in foundation phase until their own
discovery/architecture work is done).

Ground rules for this phase, decided explicitly rather than drifted into:

- **Future-domain discovery does not block Finance implementation.** Other operational modules
  (beyond Finance/reimbursement) can be specced later, whenever they come up — Finance
  implementation proceeds now regardless.
- **Spec 0002 is the current baseline**, not a final schema. When implementation reveals a
  legitimate gap, update the spec to match reality and note what changed and why — the same way
  spec 0001 already evolved once from pilot tester feedback. This is expected, healthy process,
  not a failure of planning.
- **No scope creep without a checkpoint.** Do not add Finance capabilities beyond what
  `specs/0001-reimbursement-approval-finance-workflow.md` and this charter's V1 scope (below)
  actually call for. If implementation surfaces something that seems like it should be added,
  flag it for approval before building it — don't silently expand scope because it seemed
  useful.
- **Implementation proceeds as small, tested vertical slices**, not building every screen at
  once. Each slice includes Storybook coverage for any reusable UI and automated tests where
  they add real value (per "Test Driven where appropriate," not a 100%-coverage mandate). After
  each meaningful slice: run the relevant tests, and update `.ai/WORKLOG.md` with what shipped.
- **Architectural decisions stay documented as ADRs** as implementation proceeds — a decision
  made mid-implementation is exactly as real as one made during foundation phase, and gets
  recorded the same way.

### Finance V1 scope (explicit, to prevent drift into a full accounting system)

**In scope:**
- Finance login (identifying who is acting as Finance/the accountant)
- Finance queue
- Approved-reimbursement visibility
- Receipts
- Approval history
- Finance review/status (the confirmed statuses in spec 0001)
- Notification
- Audit trail

**Not yet in scope** (deferred pending accountant discovery, not rejected):
- Xero integration
- Automatic bank transfer
- Bank APIs
- Reconciliation
- Accounting ledger
- AI/OCR automation

The reminder worth keeping visible: V1 Finance scope is essentially **"inform the accountant
that an approved reimbursement is ready for processing"** — not a full accounting system.

## Scope
- Define the Finance domain for reimbursement and disbursement workflows.
- Create a reference architecture and repository foundation.
- Establish folder layout, coding conventions, documentation patterns, and governance.
- Identify key domains, bounded contexts, and module boundaries.
- Set up design system expectations and reusable UI patterns.
- Define how future operational modules will plug into the platform.
- Provide core documentation for onboarding, architecture, and collaboration.
- **(Post-transition, Finance domain only)** Implement Finance V1 per the scope above, as
  incremental vertical slices.

## Out of Scope
- Xero integration, automatic bank transfer, bank APIs, reconciliation, accounting ledger,
  AI/OCR automation (all deferred pending accountant discovery — see Phase Transition above).
- Application code, workflows, or UI features for any domain **other than** Finance V1 as
  scoped above — other future modules remain in foundation phase (documentation-first) until
  they go through their own domain discovery and architecture decisions.
- Conducting user training or operational rollout.

## Stakeholders
- Executive Sponsor: CCF Australia leadership
- Finance Team: primary business users for Version 1
- Operations Team: future users for later modules
- Technical Leadership: engineering and architecture owners
- Product Management: requirements and prioritization
- Compliance / Audit: controls and traceability
- QA / Testing: quality standards and validation

## Success Metrics
- Approved charter and architecture before implementation begins.
- Clear domain model and module boundaries documented.
- Repository structure and contribution guidelines defined.
- Onboarding documentation sufficient for a new engineer to start work without needing architecture Q&A.
- A documented path for adding future modules and integrating Finance domain work.
- Stakeholder alignment on goals, scope, and constraints.

## Guiding Principles
- Documentation First
- Specification Driven Development
- Domain Driven Design
- Modular Monolith
- Test Driven where appropriate
- Storybook required for reusable UI
- Architecture before implementation
- AI should preserve project context between sessions
- Simplicity over cleverness
- Prefer boring, maintainable technology

## High Level Roadmap
1. Charter approval and stakeholder alignment.
2. Domain discovery and bounded context mapping for Finance.
3. Architecture definition: layered modular monolith, API boundaries, UI component strategy.
4. Repository foundation: structure, docs, conventions, and governance.
5. Technical standards: coding style, testing guidance, Storybook expectations, documentation templates.
6. Review and handoff to implementation team for Version 1 Finance build — **underway as of
   2026-08-27**, see Phase Transition above.

## Repository Principles
- Repository was a platform foundation, not feature implementation, through 2026-08-27; Finance
  V1 implementation now proceeds under the Phase Transition scope above. Other future domains
  remain foundation-only (documentation-first) until they go through their own discovery and
  architecture decisions.
- Documentation lives alongside architecture and governance.
- Every module is scoped to a domain boundary.
- Reusable components and UI patterns are documented via Storybook.
- Tests support specification and contract assurance, not just coverage.
- Changes should preserve clarity for future contributors.
- Contributors should be able to understand architecture from repo structure and docs alone.

## References
- Root README: `README.md`
- AI guidance: `.ai/CLAUDE.md`
- Worklog: `.ai/WORKLOG.md`
- Architecture docs: `docs/architecture/README.md`
- Development docs: `docs/development/README.md`
