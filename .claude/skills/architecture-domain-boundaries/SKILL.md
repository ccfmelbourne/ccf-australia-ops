---
name: Architecture & Domain Boundaries
description: Use when adding a new module/domain, deciding where a piece of logic or a new file belongs, importing across domain folders (Reimbursement/Approval/Finance/future operations areas), evaluating a new dependency or architectural pattern, or making any decision significant enough to warrant an ADR. Also use when reviewing whether existing code drifted across a domain boundary.
---

# Architecture & Domain Boundaries

## Purpose
Keep this platform a maintainable modular monolith as it grows past Reimbursement/Approval into
more operations domains (Receipts, Budget Planner, DGroup Management, Planning Centre, Finance,
Administration), without accumulating unclear ownership or premature complexity.

## The current shape (source of truth: `adr/0002-platform-architecture.md`)
One repository, one Next.js app (`platform/`), one PostgreSQL database, one auth boundary
(`platform/src/lib/user-session.ts`), one shared design system (Storybook). Internal modules are
scoped to bounded contexts, not separate deployables:

```
platform/src/lib/request-data.ts    -- Reimbursement domain (drafts, line items, receipts, submit)
platform/src/lib/approval-data.ts   -- Approval domain (pending approvals, decisions, routing)
platform/src/lib/user-session.ts    -- Auth/session (cookie signing, current-user identity)
platform/src/components/requests/   -- Reimbursement-domain UI
platform/src/components/approvals/  -- Approval-domain UI
platform/src/components/shell/      -- Platform-level UI (nav, header) -- not owned by any domain
platform/src/components/*.tsx       -- Shared design-system primitives (Button, Card, Dialog, ...)
```

**Build for maintainability and future extraction, not for premature microservice/microfrontend
architecture.** Nothing about this platform's current scale justifies multiple services, separate
repos, or inter-service auth. A module could theoretically be extracted later if a real
requirement ever demands it -- that's what "modular" buys you -- but don't build the seams for
that today.

## Rules

1. **Business logic belongs to the domain that owns it.** A Reimbursement rule (submit
   preconditions, voucher numbering) lives in `request-data.ts`, not spread across components or
   duplicated in Approval code. A real example of getting this wrong and fixing it: `getUserProfile`
   was added to `request-data.ts` because that file already imported Prisma -- convenient, not
   correct, since a user's display name/picture is Auth's concern, not Reimbursement's. It now
   lives in `user-session.ts`.
2. **Do not allow arbitrary cross-domain imports.** A domain's own exported functions
   (`getMyRequests`, `getPendingApprovalsForUser`, etc.) are its public interface -- calling those
   from a page or from another domain is fine. Reaching past them into another domain's internal
   helpers, or duplicating its query logic instead of calling it, is not.
3. **Shared code must genuinely be shared.** `src/components/shell/` is a good example: it's
   platform-level (navigation, header) and used by every domain's pages, so it's correctly
   separate from any one domain folder -- it isn't "shared" as an excuse to avoid deciding
   ownership, it's shared because no single domain owns app-wide navigation.
4. **Do not put business logic into generic "utils" merely to avoid deciding which domain owns
   it.** If you're tempted to add something to a catch-all file because you're not sure who owns
   it, that uncertainty is the actual problem to resolve, not something to paper over.
5. **Avoid premature abstraction.** Every shared UI component in this codebase so far (`Button`,
   `Select`, `Card`, `Dialog`, etc.) was extracted only after the same pattern was found repeated,
   verbatim, across multiple real call sites -- not built speculatively ahead of a second user.
   Apply the same standard to domain-level abstractions.
6. **Prefer explicit interfaces between domains where appropriate.** The notification bell needing
   an approval count reads `getPendingApprovalsForUser(userId).length` -- the Approval domain's
   own exported function -- rather than the shell querying `RequiredApproval` rows itself.
7. **External systems are integration boundaries.** Planning Centre (future), Google OAuth, Resend
   (email), Cloudflare R2 (receipt storage) each get their own thin wrapper module
   (`src/lib/google-oauth.ts`, `src/lib/notifications.ts`, `src/lib/receipt-storage.ts` are the
   existing pattern) -- domain code calls the wrapper, never the third-party SDK directly.
8. **Document significant decisions as ADRs, as they happen.** Per `.ai/PROJECT.md`: "a decision
   made mid-implementation is exactly as real as one made during foundation phase, and gets
   recorded the same way." A new bounded context, a new external integration, a stack change (e.g.
   introducing a component library), or reversing a previously-recorded decision all qualify. See
   the `documentation-adr` skill for the mechanics and `.ai/WORKLOG.md`'s slice format for
   recording the smaller, still-worth-noting decisions that don't rise to a full ADR.

## Before adding a new dependency or pattern
Ask: "Does the project actually need this?" Check `adr/0002-platform-architecture.md`'s stack
table first -- if what you need isn't there (Next.js, TypeScript, Tailwind, Storybook, Zod,
Prisma, PostgreSQL, Vercel, Cloudflare R2), that's a real signal to pause and confirm with the
decision-maker before adding it, not to add it quietly and let the ADR go stale.
