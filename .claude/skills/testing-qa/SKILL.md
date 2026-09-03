---
name: Testing & QA
description: Use when adding a test, deciding whether a change needs one, fixing a bug (regression test), or evaluating whether existing coverage actually protects a piece of behavior. Use before claiming a bug is "fixed" or a test "covers" something.
---

# Testing & QA

## What's actually here
`node --test` (Node's built-in runner) for pure logic — no added test-framework dependency,
per `docs/development/README.md`'s explicit "zero added test-framework dependencies unless a real
need for one shows up." Storybook interaction tests (`@storybook/addon-vitest`, real headless
Chromium via Playwright, run with `npx vitest run --project=storybook`) for component/UI
behavior. **There is currently no end-to-end test suite** running against a real dev server and
database — live verification during a change has so far been ad hoc (throwaway Playwright
scripts, deleted after use), which means nothing from that verification persists to catch a
regression next time. Treat this as a known, real gap, not a solved problem.

## Priorities

**High** — business rules, approval rules, authorization, financial calculations, state
transitions, security-sensitive behavior, receipt processing, notifications, PDF generation.
**Medium** — important UI workflows, forms, data validation, integration boundaries.
**Low** — trivial presentation details, framework behavior already guaranteed by the framework.

Match effort to this. The approval-routing tier logic and file-validation functions are pure and
tested directly; a component's exact pixel spacing is not worth a test.

## Rules

1. **Test business rules thoroughly**, including edge cases — see rule 3 for what "thoroughly"
   means in practice.
2. **Regression tests should be added when bugs are discovered.** `Patterns/ExpensesStepRace`
   (Storybook) exists because a real live-reported bug (removing the only receipt/line item then
   clicking Continue bypassed the requirement) had no coverage that would have caught it.
3. **Verify a regression test actually catches its bug before trusting it.** Don't assume a new
   assertion works — temporarily revert the fix and confirm the test fails at the expected line,
   then restore the fix and confirm it passes. This caught a real problem: an initial receipt-race
   test used a synchronous fake removal with no delay, which could never have raced the button at
   all — it would have passed regardless of whether the real fix existed.
4. **Do not write tests merely to increase coverage numbers.** A test that can't fail when the
   behavior it claims to cover is broken is worse than no test — it's false confidence.
5. **Tests should verify behavior, not implementation details.**
6. **Financial and approval workflows require stronger testing than simple CRUD screens.**
7. **Be honest when a test doesn't cover what it looks like it covers.** A Dialog regression
   story (`NestedConfirmationDoesNotCascadeClose`) documents a real bug fix but was directly
   verified *not* to reproduce the original bug in isolation, even when deliberately rebuilt with
   the exact original (buggy) shape. Its own comment says so plainly, rather than implying
   coverage it doesn't have. A test that can't be proven to catch its target bug should say that
   in its own comment, not stay silent about the gap.
8. **Know the limits of Storybook's interaction tests here.** Most real components call Server
   Actions, which have no server or database behind them in Storybook's Vite runtime — testing a
   flow that depends on one means building a small fixture-driven simulator (see
   `src/stories/patterns/ReimbursementForm.stories.tsx`'s own comment for why), not the real
   component. A simulator proves an *interaction pattern* is correct and stays correct; it does
   not, by itself, prove the real production component still implements it the same way. Don't
   conflate the two when reporting what's covered.
