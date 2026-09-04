# 0002. Platform Architecture: Modular Monolith on Next.js/TypeScript/Prisma/PostgreSQL

## Status
Accepted (2026-08-27) — reviewed and confirmed directly with the project's decision-maker; there is no separate engineering team to loop in at this stage. One follow-up verification remains open before the storage choice is fully locked — see "Open questions."

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
| Database | Managed PostgreSQL |
| Receipt/file storage | S3-compatible object storage — Cloudflare R2 (primary), Amazon S3 (fallback; see "Hosting and storage" below) |
| Application hosting | Vercel (V1) |

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

## Hosting and storage

**Application hosting: Vercel for V1.** The expected user base and workload are modest, the
application is built on Next.js (Vercel's native fit), and minimizing infrastructure/operational
overhead matters for a volunteer-maintained system. The application avoids unnecessary coupling
to Vercel-specific services, so it can migrate to AWS or another provider later if scale,
security, compliance, or integration requirements ever justify it — but no migration work
happens until there's a demonstrated requirement, not preemptively.

**Receipt/document storage: Cloudflare R2 (S3-compatible), using the `oc` (Oceania) location
hint, with Amazon S3 as the named fallback.** Vercel Blob was considered and is technically
viable, but was not chosen — the priority is storage portability and a clean path toward AWS if
the platform ever migrates, which an S3-compatible API gives for free. R2 was preferred over S3
itself for V1 on cost/egress grounds while staying API-compatible with the AWS fallback.
Confirmed directly with the project's decision-maker (2026-08-28) that CCF Australia's data residency
need here is a latency/locality preference, not a hard compliance guarantee — see "Data
residency" below for the technical reasoning that decision rests on.

```text
V1 (now)                              Future (if migration is ever justified)

    CCF Platform                          CCF Platform
         │                                     │
      Next.js                                AWS
         │                        ┌────────────┼────────────┐
 ┌───────┼───────┐                ▼            ▼            ▼
 ▼       ▼       ▼             Next.js        RDS           S3
Vercel PostgreSQL Object
              Storage
                 │
                 ▼
           Cloudflare R2
           (S3-compatible)
```

The application code doesn't need to fundamentally change between these two states — that
portability is the point of choosing an S3-compatible API and avoiding Vercel-specific lock-in
now, even while V1 runs entirely on Vercel.

## Consequences

**Positive**
- One deployable, one database, one place to reason about the system — appropriate for the platform's actual current scale, and avoids the operational overhead (service discovery, distributed tracing, network auth) that a microservices split would demand for no current benefit.
- A fully-typed stack top to bottom reduces an entire class of integration bugs between the form layer, validation, and the database.
- Storybook is baked in from the start rather than retrofitted, so reusable UI is a first-class deliverable per the charter, not an afterthought.

**Negative / trade-offs**
- A monolith can accumulate unclear boundaries over time if module discipline isn't maintained — mitigated by keeping modules scoped to bounded contexts (per DDD) and reviewing new modules against that boundary in PRs, not by tooling alone.
- Next.js, Prisma, and PostgreSQL together imply real hosting infrastructure (a managed Postgres instance, a Next.js hosting target) — a meaningfully bigger operational footprint than the Track A pilot's zero-infrastructure static-HTML approach, which was an intentional trade-off for that temporary pilot and is not a precedent this ADR follows.

**Data residency (resolved 2026-08-28)** — R2 offers two distinct data-placement mechanisms, and
only one is an enforceable guarantee:
- *Location Hints* (`wnam`, `enam`, `weur`, `eeur`, `apac`, `oc` for Oceania) are, in
  Cloudflare's own words, "best effort and not a guarantee" of where an object is actually
  stored.
- *Jurisdictional Restrictions*, which do guarantee storage stays within a jurisdiction, are
  only available for `eu`, `fedramp`, and `us` — there is no Australia or APAC jurisdictional
  restriction, and the jurisdiction can't be changed after a bucket is created.

The project's decision-maker confirmed CCF Australia's actual need here is a latency/locality preference,
not a hard compliance guarantee (no Privacy Act, funder, or board policy mandates an enforced
Australia-only guarantee for this data). That makes R2's `oc` location hint sufficient, so the
storage choice above stands. If that changes later, the fallback is Amazon S3 in `ap-southeast-2`
(Sydney), which does offer a real region-locked bucket — R2's S3-compatible API means the
application code wouldn't need to change, only the storage backend and a data migration of
existing objects.

(Sources: [Cloudflare R2 data location docs](https://developers.cloudflare.com/r2/reference/data-location/),
[R2 Data Localization Suite docs](https://developers.cloudflare.com/data-localization/how-to/r2/).)

## Open questions
None currently open — the one prior open question (data residency, above) was resolved with the
decision-maker on 2026-08-28.

## Related
- `.ai/PROJECT.md` — charter principles this ADR makes concrete.
- `adr/0001-reimbursement-system-of-record.md`
- `specs/0001-reimbursement-approval-finance-workflow.md`
- `docs/development/README.md` — engineering conventions building on this stack.
