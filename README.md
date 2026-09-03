# CCF Australia Operations Platform

An internal operations platform for CCF Australia, built as a modular monolith under `platform/` —
a Next.js app on Vercel with a real PostgreSQL database. Reimbursements (requests, approvals,
receipts) is the first app live in it. This repository also carries the governance layer
(architecture, specs, decisions) that Reimbursements was built against, and that future
operational modules (Budget Planner, DGroup Management, Planning Centre integrations, and more)
will go through before their own implementation starts.

## Repository contents

- `platform/` — the application itself. See `platform/README.md` to run it locally.
- `.ai/` — AI/session context, the project charter (`PROJECT.md`), and the running engineering
  worklog (`WORKLOG.md`) — read this when picking work back up.
- `docs/product/` — product and stakeholder documentation.
- `docs/architecture/` — architecture decisions and system design.
- `docs/development/` — development standards and contribution guidance.
- `adr/` — architectural decision records.
- `specs/` — domain and feature specifications.
- `.claude/skills/` — engineering guardrails (architecture, security, testing, comment style,
  etc.) that apply automatically when working in this repo.
- `.github/` — workflows, issue templates, and repository automation.

## Getting started

1. Read the charter in `.ai/PROJECT.md`, and `.ai/WORKLOG.md` for what's shipped so far.
2. Review the architecture overview in `docs/architecture/README.md` and
   `adr/0002-platform-architecture.md` for the concrete stack/structure.
3. Review development guidance in `docs/development/README.md`.
4. To run the application itself, see `platform/README.md`.
5. Adding a new domain? Read the ADR and specs usage guides in `adr/README.md` and
   `specs/README.md` before writing code — this repo is documentation-first (see
   `CONTRIBUTING.md`).

## Project charter

The approved project charter is captured in `.ai/PROJECT.md` and serves as the source of truth
for purpose, scope, stakeholders, and principles.

## Notes

- Reimbursements implementation is underway (see `.ai/PROJECT.md`'s "Phase Transition" section) —
  this repo is no longer foundation-documentation-only for that domain. Other future operational
  modules stay foundation-only until they go through their own discovery/architecture work.
- Unknown decisions are marked with TODO.
