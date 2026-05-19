# ReadTok Docs

This directory is the official note system for the codebase.

## Purpose

- Keep project truth in one place.
- Make agent and human work reproducible.
- Preserve decisions so we do not repeat old debates.
- Keep operations predictable (deploy, ingest, backup, restore).

## Document Map

- `docs/STATE.md`:
  Current product and technical state. This file is the first read for any new task.
- `docs/workflow.md`:
  Day-to-day implementation workflow, including the required note update gate.
- `docs/achievements.md`:
  Achievement definitions, counters, triggers, and rollout phase notes.
- `docs/adr/`:
  Architecture Decision Records (ADRs). One file per meaningful decision.
- `docs/runbooks/`:
  Step-by-step operational playbooks.
- `docs/ielts-reading-postgres.md`:
  Existing domain model and API contract reference for IELTS Reading data.

## Note Update Rule (Required)

Every meaningful code change must update at least one relevant note file:

- Behavior/state changed:
  Update `docs/STATE.md`.
- Architecture/strategy changed:
  Add or update an ADR in `docs/adr/`.
- Operational procedure changed:
  Update a file in `docs/runbooks/`.
- Database behavior changed:
  also update the corresponding cache/API notes so Redis behavior and read
  contracts stay aligned with the new DB truth.

If no note changes are needed, the PR/task summary must explicitly say:

`Notes update: not required (no state/decision/runbook impact).`

## Authoring Guidelines

- Prefer short, concrete notes over long narrative.
- Keep notes and comments high-signal: explain coupling, invariants, update
  traps, and intent; do not preserve stale or purely decorative commentary.
- Use copy/paste-ready commands in runbooks.
- Keep timestamps in UTC when possible.
- Keep ADRs immutable except status updates and corrections.
