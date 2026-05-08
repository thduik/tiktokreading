# ADR 0001: Official Docs System in `docs/`

- Date: 2026-05-08
- Status: Accepted

## Context

The repository previously relied on an environment-specific summary file that no longer matches how the project is operated. Team and agent work needs a stable, repo-native note system that is easy to maintain and easy to query.

## Decision

Adopt `docs/` as the official codebase memory system with four anchors:

- `docs/STATE.md` for current truth.
- `docs/workflow.md` for implementation process and docs update gate.
- `docs/adr/` for architecture decisions.
- `docs/runbooks/` for operational procedures.

Remove legacy `replit.md` from the repository.

## Consequences

- Onboarding and agent effectiveness improve due to a single canonical docs root.
- Repeated operational work becomes reproducible through runbooks.
- Contributors must maintain docs in parallel with meaningful code changes.
- Small process overhead is introduced, but intentionally minimal.

## Alternatives Considered

- Keep ad-hoc notes in chat only:
  Rejected because information decays and cannot be audited.
- Single mega README for everything:
  Rejected because it becomes hard to navigate and maintain.
