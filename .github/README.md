# GitHub Folder

This directory is reserved for repository automation, issue templates, and workflow configuration.

## Purpose
Store GitHub-specific metadata such as:
- Actions workflow files
- Issue and pull request templates
- Dependabot and community files

## Current status
- `workflows/platform-ci.yml` — runs on every push/PR to `main` that touches `platform/`:
  typecheck (`tsc --noEmit`), lint, `npm test`, and `next build`, working from `platform/` as
  its root.
- `pull_request_template.md` — PR checklist matching `CONTRIBUTING.md`'s review guidance.
- `ISSUE_TEMPLATE/domain_proposal.md` — for proposing new domain areas/rules (see `specs/`, `adr/`).
- `ISSUE_TEMPLATE/bug_report.md` — for reporting a bug in the `platform/` application.
