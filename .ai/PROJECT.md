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

## Scope
- Define the Finance domain for reimbursement and disbursement workflows.
- Create a reference architecture and repository foundation.
- Establish folder layout, coding conventions, documentation patterns, and governance.
- Identify key domains, bounded contexts, and module boundaries.
- Set up design system expectations and reusable UI patterns.
- Define how future operational modules will plug into the platform.
- Provide core documentation for onboarding, architecture, and collaboration.

## Out of Scope
- Writing production application code for the Finance module.
- Implementing workflows, business logic, or UI features.
- Building deployment pipelines, cloud infrastructure, or CI/CD automation.
- Delivering end-user functionality or final product features.
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
6. Review and handoff to implementation team for Version 1 Finance build.

## Repository Principles
- Repository is a platform foundation, not feature implementation.
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
