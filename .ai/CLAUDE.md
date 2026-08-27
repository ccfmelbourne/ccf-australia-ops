# AI Guidance for CCF Australia Operations Platform

## Purpose
Provide AI with project context, repository conventions, and documentation links so progress is preserved across sessions.

## Key references
- Project charter: `.ai/PROJECT.md`
- Engineering worklog: `.ai/WORKLOG.md`
- Product documentation: `docs/product/README.md`
- Architecture documentation: `docs/architecture/README.md`
- Development documentation: `docs/development/README.md`

## Instructions for AI
- Preserve project context between sessions.
- Application code for Finance V1 (under `platform/`) is in scope as of the Phase Transition recorded
  in `.ai/PROJECT.md` (2026-08-27) — implement as small vertical slices, per that section's rules
  (no scope creep beyond the confirmed V1 scope without flagging it; update specs when
  implementation reveals a gap). Other future domains remain foundation-only (no application
  code) until they go through their own discovery/architecture work.
- The Track A pilot (`mvp/reimbursement-voucher/`) is separate and unrelated to this rule — it's
  a temporary artifact, not part of Track B/the platform's application code.
- Keep documentation concise and cross-referenced.
- Mark unresolved decisions with TODO.

## Session continuity
When returning to this workspace, review:
- `.ai/PROJECT.md`
- `.ai/WORKLOG.md`
- `README.md`

If asked to extend the platform, align with the approved charter and repository principles.
