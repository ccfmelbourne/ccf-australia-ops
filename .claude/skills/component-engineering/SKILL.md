---
name: Component Engineering
description: Use when writing or reviewing React/Next.js components -- deciding server vs. client, structuring props, adding a hook, wiring a form to a Server Action, or handling loading/error state inside a component. Use when a component's async/mutation state needs to be visible outside itself (e.g. gating a parent's button on a child's in-flight request).
---

# Component Engineering

## Server/client boundary
Default to Server Components. Pages (`platform/src/app/**/page.tsx`) fetch data server-side and
pass plain props down. Add `"use client"` only where real client-side behavior is needed --
`useState`/`useTransition`/event handlers/`usePathname()`. Every shell component this session
(`AppShell`, `Sidebar`, `MobileNav`, `UserMenu`) is `"use client"` because it genuinely needs
interactivity (open/close state, active-route highlighting); `NotificationBell` and `StatCard`
are not, because they're pure presentation over props. Push the client boundary as low in the
tree as the actual interactivity requires -- don't mark a whole page client just because one
child needs it.

## Server Actions and mutation state
Mutating components (`ReceiptManager`, `LineItemManager`, `BankDetailsManager`) call a Server
Action, then `router.refresh()` to pick up the change -- there is no client-side cache to
invalidate, the refetch *is* the state update. That refetch is asynchronous, which is exactly
the gap a real bug lived in: a wizard step's Continue button gated on `data.receipts.length`
alone had no way to know a removal was still in flight, so clicking Continue in that window
read stale data and slipped past its own requirement.

**If a child's own mutation needs to be visible to a parent's gating logic, report it explicitly
-- don't infer it from data that hasn't caught up yet.** The fix here: `ReceiptManager`/
`LineItemManager` accept an optional `onPendingChange?: (pending: boolean) => void` and report
their own `isPending` upward via a `useEffect`; the parent factors that into its own `disabled`
condition alongside the real data check. Reach for this same pattern before trusting a prop that
a sibling mutation might have just invalidated.

## Rules

1. **Prefer TypeScript everywhere** -- no `any` as a substitute for modeling the actual shape.
2. **Prefer simple components over overly generic abstractions.** `StatCard` takes `label` and
   `count`; it doesn't take a `variant` prop or a render-prop until a second, genuinely different
   use case shows up.
3. **Keep components focused.** `ReceiptManager` owns receipts; it doesn't also own line-item
   logic just because they render near each other.
4. **Use Server Components by default; Client Components only when client behavior is
   required** (see above).
5. **Keep domain logic out of presentation components.** A `Card` or `Table` never imports from
   `@/lib/request-data` or `@/lib/approval-data` -- domain data arrives as props from whatever
   page/layout fetched it.
6. **Reuse shared components** (see `ui-ux-design-system`) rather than re-implementing their
   markup inline.
7. **Avoid components with excessive configuration.** If a component is accumulating boolean
   props to handle every caller's slightly different need, that's a sign two components are
   trying to be one -- split them instead of adding another flag.
8. **Do not create abstractions until they solve a real problem.** Every shared component and
   every callback pattern in this codebase (including `onPendingChange` above) exists because a
   specific, real bug or duplicated pattern demanded it -- not because it seemed like good
   practice in the abstract.

## A concrete pattern worth copying: `closeRef` over render-props
`Dialog`'s `close()` is exposed via a `closeRef` the caller creates with `useRef` and reads from
anywhere, not a render-prop callback. That's a deliberate choice: `ApprovalDrawer`'s decide/reject
handlers are top-level `async` functions, not inline JSX, and a render-prop would have forced
them into the JSX tree for no reason. When a component needs to hand its caller an imperative
action, prefer a ref the caller owns over restructuring the caller's code to fit a callback shape.
