---
name: Code Comment Discipline
description: Use whenever writing or reviewing a code comment, and whenever editing a file that already has comments nearby. Applies to every language and every file in this repo.
---

# Code Comment Discipline

## The primary rule
**Do not add comments merely to describe what the code does.** Well-named identifiers already do
that; a comment restating them adds nothing and rots as the code evolves.

Bad:
```ts
// Loop through all receipts
for (const receipt of receipts) {
  ...
}
```
```ts
// Set the status to approved
request.status = "APPROVED";
```
These describe WHAT. The reader can already see that.

## When a comment earns its place
A comment is appropriate when it explains something the code can't say on its own:
- **WHY** something is implemented a particular way
- an important **business rule**
- a **security decision**
- a non-obvious **workaround**
- an **architectural constraint**
- an **external system limitation**
- a subtle **edge case**
- information a future developer genuinely needs and has no other way to find

Good, real example from this codebase:
```ts
// Uses array-form prisma.$transaction([...]) throughout, not the
// interactive prisma.$transaction(async (tx) => {...}) callback form. In
// this exact stack (Prisma 7 + @prisma/adapter-pg + Next.js dev server,
// tested against Neon), a second interactive transaction issued shortly
// after a first one silently failed to persist its writes -- no thrown
// error, no log -- while array-form transactions did not exhibit this.
```
That's useful: it explains a non-obvious, hard-won constraint a future developer would otherwise
have no way to know, and would plausibly "fix" by switching back to the callback form.

Another shape worth recognizing — explaining why an error is deliberately swallowed:
```ts
// Approval email failures must not roll back the approval decision.
// Email is a notification channel, not the authoritative workflow state.
try {
  await sendApprovalEmail(...)
} catch {
  ...
}
```

## Applying this to existing code
The discipline applies when you touch existing files, not just new ones:
- Remove unnecessary comments you encounter when practical, in the file you're already editing.
- Simplify comments that merely describe obvious code.
- Preserve useful comments explaining WHY.
- Don't rewrite a comment unnecessarily if it already provides useful context.
- **Do not go looking for a big comment-cleanup refactor unless explicitly asked.** Apply this
  discipline to code you're already touching for another reason, not as a standalone pass across
  files you'd otherwise have no reason to open.

## A quick self-check before writing a comment
If you deleted this comment, would a future reader (including you, in six months) be confused,
misled, or missing something they'd otherwise have no way to find out? If not, delete it instead
of writing it.
