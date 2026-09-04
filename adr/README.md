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
- `0002-platform-architecture.md` — modular monolith on Next.js/TypeScript/Tailwind/Storybook/Zod/Prisma/PostgreSQL, hosted on Vercel for V1 with Cloudflare R2 (Oceania location hint) for receipt storage. Status: Accepted, no open follow-ups.
- `0003-ccf-user-allowlist.md` — Google OAuth authenticates identity only; a `User.status` allowlist (checked at sign-in and on every request) decides platform access, since CCF users sign in with personal Gmail addresses and no domain restriction is available. Status: Accepted.
