# ADRs

Architectural Decision Records (ADRs) capture major design choices and the reasons behind them.

## Purpose
Use this folder for decisions that shape the platform, such as architecture style, module boundaries, technology choices, and domain modeling.

## How to use
- Create one Markdown file per decision.
- Use a consistent naming scheme, such as `0001-modular-monolith.md`.
- Include: status, context, decision, consequences.

## Current status
- `0001-reimbursement-system-of-record.md` — the application (not email/PDF) is the system of record for reimbursements; email is notification only.
- `0002-platform-architecture.md` — modular monolith on Next.js/TypeScript/Tailwind/Storybook/Zod/Prisma/PostgreSQL. Status: Proposed, pending full engineering-team review.
