# Testing ReadTok

## Standard Commands

From repo root:

```bash
corepack pnpm run doctor
corepack pnpm run typecheck
corepack pnpm run test
```

The repo expects Node `20.19.5` and `pnpm@10.33.2`. Run `nvm install && nvm use`
from the repo root before building locally.

The test command runs package-level suites with Node's built-in test runner via
`tsx`.

## Current Test Coverage

- Ranking logic:
  rank thresholds, LP deltas, XP deltas, rank movement, and LP floor.
- Answer analytics:
  band/type normalization, rolling-date helpers, accuracy calculation, and
  period aggregation.
- Frontend product logic:
  daily goal progress and rank plate division calculation.
- Migration smoke checks:
  required constraints for progress and daily answer buckets.
- Ingest pipeline:
  answer-key prefix cleanup such as `4.A`, matching options beyond `D`, and
  six-question mixed-card conversion.

## Local Sandbox Note

`tsx` may fail inside restricted sandboxes because it opens a local IPC pipe.
If that happens, rerun the same command outside the sandbox. This is an
environment permission issue, not a failing test assertion.

## Next Good Additions

1. API integration test for `POST /api/me/submit-answer` with a test database.
2. Profile rendering smoke test once React Testing Library is added.
3. One or two Playwright checks for feed answer flow and Profile stats display.
