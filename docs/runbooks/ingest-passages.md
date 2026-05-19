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

NDJSON mixed-card ingest (current production default):

```bash
pnpm --filter @workspace/db exec tsx ./src/scripts/ingest-ndjson-cards.ts ./path/to/batch.ndjson
```

Notes:

- `factory_tag` now defaults to `v5` in `ingest-ndjson-cards.ts`.
- The List filter exposes `v5+` as the forward-looking production bucket. New
  passage generations at `v5`, `v6`, `v7`, and above should continue to appear
  there automatically; do not add a new frontend version option for each new
  passage machine increment unless product behavior changes.
- You can still override explicitly when needed:

```bash
pnpm --filter @workspace/db exec tsx ./src/scripts/ingest-ndjson-cards.ts ./path/to/batch.ndjson --factory-tag=v5
```

- If a batch omits `band`, pass it explicitly:

```bash
pnpm --filter @workspace/db exec tsx ./src/scripts/ingest-ndjson-cards.ts ./path/to/batch.ndjson --band-label=7.0
```

- Matching Heading and Matching Information currently store as MCQ-style
  questions with labels preserved.
- Option keys may extend beyond `D` for matching questions. The ingest script
  keeps all provided options and canonicalizes option answers through `H`.
- After production deploy, the VPS deploy script now runs
  `refresh-passage-search-catalog.ts` automatically, so search/catalog refresh
  is part of the guarded deploy path rather than a manual cleanup step.
- Frontend passage list/detail caches no longer depend on hand-edited cache
  version strings. Cache namespaces derive from `/api/passages/ids` or
  `/api/passages/feed-bootstrap` response `version` values.

## Expected Outcome

- `passages`, `questions`, `answer_keys` tables updated.
- Passage list and detail APIs return the new content.
- Search catalog refresh is included in deploy verification for hosted updates.
- If ingest modifies rules or quality checks, update `docs/STATE.md` and runbook notes.
