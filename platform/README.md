# CCF Australia Platform

The internal operations platform for CCF Australia — one Next.js app, built as a modular
monolith so more operational domains (Budget Planner, DGroup Management, Planning Centre
integrations, and others) can be added alongside the first one without a rework. See
`../.ai/PROJECT.md` for the full charter and `../adr/` for why the stack below was chosen.

## First app: Reimbursements
The first domain live in this platform. Requesters submit reimbursement/cash-advance requests
with line items, receipts, and bank details; a role-based approval chain (Ministry Overseer, COS,
Finance Overseer, Regional Director, depending on the request's tier and ministry) reviews and
decides; an approved request generates a voucher PDF and notifies Finance.

## Stack
Next.js (App Router) / TypeScript / Tailwind CSS / Storybook, Prisma 7 + PostgreSQL, Cloudflare
R2 (receipt/signature storage, S3-compatible), Resend (email), Google OAuth (sign-in), Google
Cloud Vision (optional receipt-scan assist), hosted on Vercel. Full rationale:
`../adr/0002-platform-architecture.md`.

## Setup
1. `npm install` (runs `prisma generate` via `postinstall`).
2. Copy `.env.example` to `.env` and fill in real values — every variable's own comment explains
   what it's for and where to get it. At minimum for local dev you need `DATABASE_URL` (a real
   Postgres instance — Neon/Vercel Postgres/Supabase all work), `APP_SESSION_SECRET`, and Google
   OAuth credentials; the rest (Resend, R2, Vision, Cron) are needed for their specific features
   but the app runs without them.
3. `npm run db:migrate` — applies migrations to your database.
4. `npm run db:seed` — seeds ministry/approver assignment data the app expects to exist.
5. `npm run dev` — starts the app at `http://localhost:3000`.

**Signing in locally without setting up Google OAuth:** in development only (`NODE_ENV !==
"production"`), `/sign-in` shows two extra links that bypass Google entirely and sign you in as a
synthetic test requester or approver — see `src/app/api/dev/login/route.ts`. This route 404s in
production.

## Everyday commands
| Command | What it does |
|---|---|
| `npm run dev` | Start the app (Turbopack). |
| `npm run build` / `npm start` | Production build / run it. |
| `npm run lint` | ESLint. |
| `npm test` | `node --test` over `src/lib/**/*.test.ts` — pure-logic unit tests. |
| `npm run storybook` | Component/pattern library at `http://localhost:6006`. |
| `npx vitest run --project=storybook` | Storybook's own interaction tests (real headless Chromium). |
| `npx tsc --noEmit` | Typecheck. |
| `npm run db:studio` | Browse the database (Prisma Studio). |

Before committing, this project expects `tsc --noEmit`, `lint`, `test`, `build`, and the
Storybook interaction suite all clean — see `../docs/development/README.md` for the fuller
convention (branching, commit style, testing philosophy).

## Where things live
- `src/app/` — routes. `(app)/` is the signed-in shell (Dashboard/My Requests/Approvals) behind
  one auth guard; `sign-in/`, `api/auth/`, `api/dev/` are unauthenticated/auth-adjacent.
- `src/components/` — shared design-system primitives (`Button`, `Card`, `Dialog`, `Table`, ...,
  all documented in Storybook) plus per-domain UI in `requests/`, `approvals/`, and the app shell
  in `shell/`.
- `src/lib/` — domain logic and data access, one module per bounded context (`request-data.ts`
  for Reimbursement, `approval-data.ts` for Approval, `user-session.ts` for auth/identity, plus
  thin wrappers around each external integration — email, receipt storage, OCR, PDF).
- `src/stories/` — Storybook `Foundations/` (design tokens) and `Patterns/` (full workflows) pages
  that don't belong to one single component.
- `prisma/` — schema, migrations, seed script.

See `.claude/skills/architecture-domain-boundaries/SKILL.md` (repo root) for the fuller rationale
behind this shape, and the other skills there for security, testing, and comment conventions this
codebase follows.
