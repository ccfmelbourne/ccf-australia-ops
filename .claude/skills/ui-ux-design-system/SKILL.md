---
name: UI/UX & Design System
description: Use when building or changing any UI -- pages, forms, tables, dialogs/panels, navigation, loading/empty/error states, or anything visual. Use before creating a new component to check whether an existing one already covers it. Also use when a UI change affects volunteers or infrequent users, not just daily staff.
---

# UI/UX & Design System

## Technology
Tailwind CSS + Storybook, per `adr/0002-platform-architecture.md`. **This platform does not use
shadcn/ui or any other component library** -- the accepted stack is plain Tailwind with a
hand-rolled, Storybook-documented component set. If that ever needs to change, it's a stack
change and needs an ADR update first (see `architecture-domain-boundaries`), not a quiet
per-component decision.

## Reuse before creating
Check `platform/src/components/` before writing new markup. As of this writing it already has:
`Button`, `Input`, `Select`, `Card`, `Badge`, `Alert`, `Table`, `Dialog`, `FileDropzone`,
`MoneyStat`, `RequestStatusBadge`, `EmptyState`, `Skeleton`, `SectionHeading`, `ErrorBanner`, plus
the app shell (`components/shell/`: `AppShell`, `Sidebar`, `MobileNav`, `NotificationBell`,
`UserMenu`, `StatCard`). Every one of these was extracted from a pattern already repeated across
real screens, documented in Storybook, then adopted at call sites as a separate, verified step --
follow that same order for anything new: build against a real repeated need, story it, adopt it,
don't invent a component ahead of a second user.

**`Dialog` is the shared panel shell** (native `<dialog>`, `showModal()` on mount, no
backdrop-click-to-close, a header with title/badge/X) -- reuse it for any new side panel rather
than hand-rolling another native-dialog wrapper. See its own SKILL-adjacent history: three
separate live bugs (backdrop-click closing a panel accidentally, a CSS positioning bug, a
browser-level modal-stacking bug) all came from copies of this pattern drifting apart before it
was extracted -- a fourth hand-rolled copy is a real risk, not a hypothetical one.

## Rules

1. **Reuse existing components before creating new ones.** If you're about to write
   `rounded-md border border-slate-300 px-3 py-2 text-sm` again, that's `Input`/`Select`; a
   bordered `p-4` box is `Card`; a status pill is `Badge`.
2. **Do not create visually inconsistent one-off components.** New UI should read as part of the
   same app as everything else -- teal-600 primary, slate neutrals, no dark mode (this app is
   deliberately light-only, see `globals.css`'s `color-scheme: light` and its own comment on why).
3. **Prefer clear, workflow-oriented interfaces.** The wizard-style create-request flow
   (`WizardSteps`, step-gated Continue buttons) over a single giant form is the established
   pattern for multi-step processes.
4. **Forms communicate current state, required fields, validation, and what happens next.**
   Disabled-button reasons are surfaced as inline text next to the button (see
   `CreateWizard`'s "Add at least one expense to continue" pattern), not left for the user to
   guess.
5. **Important actions get clear confirmation and feedback.** Submitting a reimbursement (an
   action that starts a real approval chain and can't be undone) goes through an explicit
   confirm step, not straight from the Review screen's Submit button.
6. **Design for volunteers who may not use the system every day.** Favor obvious labels and
   explicit next-steps over dense, expert-mode UI. This is also why the sidebar app shell exists
   at all -- a persistent, always-visible nav beats requiring someone to remember a URL.
7. **Avoid unnecessary visual complexity.** Minimal motion only (the dialog-fade/drawer-slide
   keyframes in `globals.css` are the ceiling, not a starting point -- no bounce, no looping
   animation).
8. **Accessibility is part of UI quality, not optional.** Every interactive element needs a real
   accessible name (a plain `aria-label` is fine) -- watch for two controls accidentally sharing
   one name (found live: the notification bell's fallback label collided with the sidebar's own
   "Approvals" link before being renamed to "Notifications").

## States to cover for any new reusable component or pattern
Default, loading, empty, error, disabled, validation error, success, and (where relevant)
permission-restricted -- see `src/stories/patterns/` for the existing examples
(`LoadingStates`, `EmptyStates`, `ErrorStates`, `ConfirmationStates`, `FormSections`).
