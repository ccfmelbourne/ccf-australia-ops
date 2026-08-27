# GitHub Folder

This directory is reserved for repository automation, issue templates, and workflow configuration.

## Purpose
Store GitHub-specific metadata such as:
- Actions workflow files
- Issue and pull request templates
- Dependabot and community files

## Current status
- `pull_request_template.md` — PR checklist matching `CONTRIBUTING.md`'s review guidance.
- `ISSUE_TEMPLATE/domain_proposal.md` — for proposing new domain areas/rules (see `specs/`, `adr/`).
- `ISSUE_TEMPLATE/bug_report.md` — for the Track A pilot or Track B application code.
- TODO: Add an Actions CI workflow once Track B has application code to test on `main`. The
  Track A pilot already has its own test suite (`node --test` under
  `mvp/reimbursement-voucher/tests/`), but it lives on its own branch outside `main`'s scope —
  see `docs/development/README.md` for the testing convention to extend once Track B code lands.
