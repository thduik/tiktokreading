# Question Paraphrase QC

This folder tracks prompt-level paraphrase cleanup for question types that
should not mirror the passage wording too closely.

Current scope:

- `TFNG`
- `Sentence Completion`
- `Short Answer`

Files:

- `question-paraphrase-current-batch.json`
  Generated batch of the next unresolved flagged items.
- `question-paraphrase-progress.ndjson`
  Append-only ledger of reviewed or fixed items.
- `question-paraphrase-summary.json`
  Latest scan summary for the active band.

Primary command:

```bash
pnpm --filter @workspace/db run audit:question-paraphrase -- --band=8.0+ --limit=40
```

Recommended cadence (fast cleanup):

```bash
pnpm --filter @workspace/db run audit:question-paraphrase -- --band=8.0+ --limit=60 --summary
```

The script writes the next unresolved batch to:

`docs/qc/question-paraphrase-current-batch.json`

Apply fixes from a JSON file:

```bash
pnpm --filter @workspace/db run audit:question-paraphrase -- --band=8.0+ --apply-fixes=./docs/qc/fixes-8plus.json
```

Practical workflow:

1. Generate next batch with `--limit=60`.
2. Create a fixes file for those 60 prompts.
3. Apply fixes with `--apply-fixes=...`.
4. Re-run summary and repeat until `nextBatchCount` is `0`.
5. Move to next band (`7.5`, then `7.0`).
