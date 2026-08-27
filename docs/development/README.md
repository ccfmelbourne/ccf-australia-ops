# Development Documentation

This folder describes the conventions, standards, and workflows for engineering work in the repository.

## Purpose
Provide clear guidance for contributors on repository structure, documentation expectations, and development principles.

## Current contents
- `README.md` — development overview and navigation.

## Expectations
- Write documentation before implementation.
- Create ADRs for major technical decisions in `adr/`.
- Define domain and behavior through specifications in `specs/`.
- Keep changes simple and maintainable.

## Stack
The platform's technology choices are recorded in `adr/0002-platform-architecture.md`
(Next.js, TypeScript, Tailwind, Storybook, Zod, Prisma, PostgreSQL, in a modular-monolith
shape) — read that ADR before starting implementation work rather than assuming a stack.

## Branching and PRs
- `main` is protected — changes land through a pull request, not a direct push.
- Once real implementation work starts, branch per bounded-context/module (e.g.
  `feature/finance-reimbursement-api`), not one broad branch for everything — keeps history
  reviewable and lets one module's work be reverted without touching another's.
- Keep the Track A pilot's branch (`pilot/reimbursement-voucher-test`) and any future
  Track B feature branches separate; Track A does not merge into `main` (see
  `docs/mvp/test-environment.md` and the pilot's own scope notes for why).
- Follow the PR guidance already in `CONTRIBUTING.md` (why, not just what; reference the
  relevant ADR/spec; single-purpose PRs).

## Commit messages
Conventional-commit-style prefixes are the established convention in this repo's history —
`docs:`, `feat:`, `fix:`, each with a scope in parentheses where it adds clarity (e.g.
`docs(mvp): ...`). Keep the summary line imperative and under ~72 characters; use the body for
why, not what.

## Testing
No application code exists on `main` yet, so there's no CI test suite to run here. The
Track A pilot set the precedent to follow once Track B has code: plain `node --test` (Node's
built-in test runner) for pure logic, zero added test-framework dependencies unless a real
need for one shows up. "Test-driven where appropriate" per the charter — not a blanket
100%-coverage mandate.

## References
- Project charter: `.ai/PROJECT.md`
- Architecture overview: `docs/architecture/README.md`
- Platform stack ADR: `adr/0002-platform-architecture.md`
- Contribution guidance: `CONTRIBUTING.md`
- Worklog: `.ai/WORKLOG.md`
