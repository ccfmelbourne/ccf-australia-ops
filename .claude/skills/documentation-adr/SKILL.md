---
name: Documentation & ADR
description: Use when making an architectural decision, finishing a meaningful slice of work, reversing or changing a prior decision, or deciding whether something needs a new doc versus an update to an existing one. Use at the start of a session in this repo, and before committing a significant change.
---

# Documentation & ADR

## The existing structure -- read it, don't just add to it
This repo already has a full documentation layer at the root (not just inside `platform/`):
`adr/` (architectural decision records), `specs/` (domain/behavior specs), `docs/` (product,
architecture, development guidance), `.ai/PROJECT.md` (charter), `.ai/WORKLOG.md` (running log of
shipped work), `CONTRIBUTING.md`. Per `.ai/CLAUDE.md`: review `.ai/PROJECT.md`, `.ai/WORKLOG.md`,
and `README.md` when returning to this workspace. **A real cost of skipping this once**: an entire
session's worth of work (a design system, a Dialog component, an app-shell rebuild) shipped
without a single worklog update, and the app-shell rebuild reversed a decision recorded in an
earlier worklog slice (combining Approvals/My Requests onto one page, for a specific documented
reason) without knowing that reason existed — found only afterward, by reading the history that
should have been checked first.

## Rules

1. **Documentation should explain decisions and important system behavior.** Not restate what
   the code already makes obvious.
2. **Do not document obvious code.** If a comment or doc entry would just be a description of
   what the next line does, it doesn't belong (see `code-comment-discipline` for the same rule
   applied inline).
3. **ADRs are for significant architectural decisions** — new bounded context, new external
   integration, a stack change, reversing a previous ADR. One file per decision in `adr/`,
   following the existing `000N-title.md` numbering and the Status/Context/Decision/Consequences
   shape already used in `adr/0001-*.md`/`adr/0002-*.md`.
4. **Smaller, still-worth-recording decisions go in `.ai/WORKLOG.md`**, not a new ADR — a new
   "Slice N" entry per meaningful chunk of shipped work, matching the existing entries' density
   (what shipped, what was found along the way, how it was verified). This is the right place for
   something like "we reversed an earlier UX decision because the reason for it no longer holds" —
   exactly specific enough to prevent the next person from re-deriving (or blindly re-reversing)
   the same tradeoff.
5. **Keep documentation current when behavior changes.** A decision that gets silently reversed
   in code without a matching WORKLOG/ADR note is worse than no documentation — it leaves a
   contradiction on record with nothing explaining which one is current.
6. **Prefer concise documentation.** Match the existing worklog entries' style: dense, specific,
   WHY-focused, no padding.
7. **Do not create a new markdown file when an existing document is the correct place.** A new
   architectural decision is an ADR; a new domain's behavior is a spec; a shipped slice of work is
   a WORKLOG entry. Don't invent a fourth kind of document for something that already has a home.
8. **Avoid documentation duplication.** Point to an existing ADR/spec instead of re-explaining its
   content.

## Before committing a significant change
Ask: does this reverse, contradict, or build directly on something already recorded in `adr/`,
`specs/`, or `.ai/WORKLOG.md`? If yes, that context belongs in the commit/PR and in a WORKLOG
entry (or a new/updated ADR, if it rises to that level) — not left for the next reader to
rediscover by accident.
