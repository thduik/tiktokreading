# Ingest Passages

## Scope

Import/ingest IELTS reading passage datasets into PostgreSQL using repo tooling.

## Preconditions

- DB env configured (for local or target environment).
- Input file validated (JSON/NDJSON pipeline as applicable).

## Core Commands

From repo root:

```bash
pnpm --filter @workspace/db run migrate
pnpm --filter @workspace/db run import:sample
```

Custom import path:

```bash
pnpm --filter @workspace/db run import:sample -- ./path/to/cards.json
```

Vocab backfill/normalization:

```bash
pnpm --filter @workspace/db run backfill:vocab
```

Answer key anomaly audit:

```bash
pnpm --filter @workspace/db run audit:answer-keys
```

V2 NDJSON mixed-card ingest:

```bash
pnpm --filter @workspace/db exec tsx ./src/scripts/ingest-ndjson-cards.ts ./path/to/batch.ndjson --factory-tag=v2
```

Notes:

- Matching Heading and Matching Information currently store as MCQ-style
  questions with labels preserved.
- Option keys may extend beyond `D` for matching questions. The ingest script
  keeps all provided options and canonicalizes option answers through `H`.

## Expected Outcome

- `passages`, `questions`, `answer_keys` tables updated.
- Passage list and detail APIs return the new content.
- If ingest modifies rules or quality checks, update `docs/STATE.md` and runbook notes.
