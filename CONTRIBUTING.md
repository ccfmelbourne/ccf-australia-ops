# Contributing to CCF Australia Operations Platform

This repository is a foundation-first engineering platform. Contributions should reinforce documentation, architecture, and governance before any implementation work.

## Start here
1. Read the project charter in `.ai/PROJECT.md`.
2. Review the repository overview in `README.md`.
3. Check architecture guidance in `docs/architecture/README.md`.
4. Review development expectations in `docs/development/README.md`.

## Documentation-first workflow
- Capture decisions and context before implementation.
- Add architecture decisions to `adr/`.
- Add domain/feature specs to `specs/`.
- Add product context to `docs/product/`.
- Add engineering guidance to `docs/development/`.
- Keep documentation concise, linked, and non-duplicative.

## Folder responsibilities
- `.ai/` — AI context, project charter, and worklog.
- `docs/product/` — product goals, business context, and domain discovery.
- `docs/architecture/` — architecture shape and design rationale.
- `docs/development/` — contribution and engineering guidance.
- `adr/` — architectural decision records.
- `specs/` — domain and behavior specifications.
- `.github/` — repository metadata, workflows, and templates.

## Pull request guidance
- Describe why the change is needed, not just what changed.
- Reference the charter or an ADR if relevant.
- Keep PRs focused on a single purpose.
- Mark unresolved decisions as `TODO` when a clear decision is not yet available.

## Review expectations
- Prefer clarity over completeness.
- Validate that new docs point to existing references instead of repeating them.
- Confirm that the repository structure is easier to understand after the change.

## TODOs for future governance
- Add issue and PR templates to `.github/`.
- Add GitHub workflow guidance once the process is defined.
- Add a maintenance checklist for new modules.
