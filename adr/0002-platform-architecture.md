# 0002. Platform Architecture: Modular Monolith on Next.js/TypeScript/Prisma/PostgreSQL

## Status
Proposed — restates and formally records a stack discussion from earlier architecture planning. Not yet reviewed with the full engineering team; treat the technology choices as strong defaults to confirm, not final until this ADR is marked Accepted.

## Context
The project charter (`.ai/PROJECT.md`) commits to several architectural principles without naming concrete technology: a modular monolith, domain-driven design with bounded contexts (Finance first), Storybook for reusable UI, test-driven development "where appropriate," and a general preference for "boring, maintainable technology" over novelty. `adr/0001-reimbursement-system-of-record.md` and `specs/0001-reimbursement-approval-finance-workflow.md` further commit the platform to being the authoritative system of record for the Finance domain, with a real database and receipt storage — which the Track A pilot (deliberately, per its own scope) does not have.

This ADR records the concrete stack and structural shape those principles imply, so Track B implementation work has something specific to build against instead of re-deriving it per module.

## Decision

**Structure:** a single deployable modular monolith, not microservices. Internal modules are scoped to bounded contexts (Finance/Reimbursement first, per ADR 0001 and spec 0001), with clear boundaries between modules even though they ship as one application. This matches the charter directly and avoids infrastructure complexity (multiple services, inter-service networking/auth) that nothing about the current scope justifies.

**Stack:**

| Concern | Choice |
|---|---|
| Framework | Next.js |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Component/design system | Storybook (required for reusable UI, per charter) |
| Schema validation | Zod |
| ORM | Prisma |
| Database | PostgreSQL |
| Receipt/file storage | Object storage (provider not yet chosen — see Open questions) |

Rationale: this is a single, consistently-typed stack end to end (TypeScript types flow through Zod validation and Prisma's generated client), each piece is a mainstream, well-supported choice rather than a novel one (matching "prefer boring, maintainable technology"), and Storybook satisfies the charter's explicit reusable-UI requirement directly rather than needing a separate tool.

**Domain module shape**, following ADR 0001/spec 0001 as the first concrete case:

```text
                    Next.js
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   Reimbursement    Approval       Finance
        │              │              │
        └──────────────┼──────────────┘
                       ▼
                   PostgreSQL
                       │
                       ▼
                 Receipt Storage
```

Each domain module (Reimbursement, Approval, Finance, and future modules) owns its own data access and business logic behind a clear internal boundary, even though all modules share one Next.js app and one database — this is what "modular" means here, not a suggestion to split into separate deployables later without a concrete reason to.

## Consequences

**Positive**
- One deployable, one database, one place to reason about the system — appropriate for the platform's actual current scale, and avoids the operational overhead (service discovery, distributed tracing, network auth) that a microservices split would demand for no current benefit.
- A fully-typed stack top to bottom reduces an entire class of integration bugs between the form layer, validation, and the database.
- Storybook is baked in from the start rather than retrofitted, so reusable UI is a first-class deliverable per the charter, not an afterthought.

**Negative / trade-offs**
- A monolith can accumulate unclear boundaries over time if module discipline isn't maintained — mitigated by keeping modules scoped to bounded contexts (per DDD) and reviewing new modules against that boundary in PRs, not by tooling alone.
- Next.js, Prisma, and PostgreSQL together imply real hosting infrastructure (a managed Postgres instance, a Next.js hosting target) — a meaningfully bigger operational footprint than the Track A pilot's zero-infrastructure static-HTML approach, which was an intentional trade-off for that temporary pilot and is not a precedent this ADR follows.

## Open questions
- Object storage provider for receipts is not yet chosen (e.g. S3-compatible, Vercel Blob, Cloudflare R2) — needs a decision when the Reimbursement module's receipt-upload work actually starts, informed by whatever hosting target Next.js itself ends up on.
- Hosting target for the real platform (Vercel, or something else) is not decided by this ADR — Track A's pilot use of Vercel was scoped to that pilot only (see `docs/mvp/deployment-plan.md`) and doesn't bind Track B.
- This ADR has not yet been reviewed by the full engineering team; mark Accepted once it has been.

## Related
- `.ai/PROJECT.md` — charter principles this ADR makes concrete.
- `adr/0001-reimbursement-system-of-record.md`
- `specs/0001-reimbursement-approval-finance-workflow.md`
- `docs/development/README.md` — engineering conventions building on this stack.
