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

If local `corepack`/`orval` commands still pick up Node 18, verify with:

```bash
node -v
cat .nvmrc
```

For one-off local recovery, a direct Node 20 binary also works:

```bash
PATH="/tmp/node-v20.19.5-darwin-arm64/bin:$PATH" node -v
```

The test command runs package-level suites with Node's built-in test runner via
`tsx`.

## Current Test Coverage

- Ranking logic:
  rank thresholds, LP deltas, XP deltas, rank movement, and LP floor.
- Answer analytics:
  band/type normalization, rolling-date helpers, accuracy calculation, and
  period aggregation.
- Frontend product logic:
  daily goal progress, rank plate division calculation, and feed runtime helper
  behavior.
- Profile helper logic:
  display-name normalization, achievement XP leveling, percentage helpers, and
  vocab bank term normalization.
- Migration smoke checks:
  required constraints for progress and daily answer buckets.
- API contract generation:
  `lib/api-spec/openapi.yaml` can regenerate Orval client/zod outputs when run
  under Node `20.19.5`.
- Ingest pipeline:
  answer-key prefix cleanup such as `4.A`, matching options beyond `D`, and
  six-question mixed-card conversion.

## Local Sandbox Note

`tsx` may fail inside restricted sandboxes because it opens a local IPC pipe.
If that happens, rerun the same command outside the sandbox. This is an
environment permission issue, not a failing test assertion.

## Next Good Additions

1. API integration test for `POST /api/me/submit-answer` with a test database.
2. API integration test for `GET /api/me/dashboard-stats` and public leaderboard
   user detail payloads.
3. Profile rendering smoke test once React Testing Library is added.
4. One or two Playwright checks for feed answer flow, profile load, and
   leaderboard detail display.
