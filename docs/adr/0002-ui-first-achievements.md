# ADR 0002: UI-First Achievement Engine

## Status

Accepted

## Context

ReadTok needs lightweight gamification: achievements, naming tiers, daily goal
hooks, rolling accuracy windows, and profile display. Earlier product direction
favored keeping gamification logic in the UI for speed because achievements are
motivational, not authoritative scoring.

Ranked LP remains server-backed through `/me/submit-answer`.

## Decision

Implement achievements as a UI/local-first engine for now.

- Achievement definitions live in code.
- V1 achievements are active.
- V2 definitions exist behind a phase flag.
- Unlocks and progress counters live in local app state.
- Profile displays achievement progress from local state.
- Feed answer/save/report/rank events update local progress.

Backend persistence is deferred until cross-device achievement sync becomes a
product requirement.

## Consequences

Benefits:

- Fast implementation.
- No migration risk for the live backend.
- Easy tuning of names, tiers, thresholds, and active phases.
- No new auth/backfill complexity.

Tradeoffs:

- Achievement unlocks are device-local for now.
- Clearing browser storage clears local achievement state.
- Future backend sync will need either aggregate progress columns or an
  answer-attempt event table.

## Backend Path Later

Add `user_achievements` with `UNIQUE(user_id, achievement_key)`.

Recommended future table:

```sql
CREATE TABLE user_achievements (
  user_id text NOT NULL,
  achievement_key text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_key)
);
```

If rolling-window achievements become important across devices, store answer
attempt events instead of trying to infer exact last20/last50/last100 windows
from aggregate counters.
