# ADR 0003: API Cache Policy and Feed Passage Sampling

Date: 2026-05-10

## Status

Accepted

## Context

The app can hold hundreds or thousands of reading passages. Feed should feel random
without being biased toward the first page of ordered database results. List should
remain browseable and filterable. Public read-heavy API endpoints should use Redis
when configured, while user-specific and admin mutation endpoints should avoid
shared caching.

## Decision

Use Redis for public, read-heavy API data:

- `GET /api/passages`
- `GET /api/passages/:id`
- `GET /api/passages/ids`
- rank tier lookup shared by `/api/me` and `/api/leaderboard`
- leaderboard rows with a short TTL

Do not Redis-cache user/private or mutation endpoints:

- `/api/me` profile/progress responses
- `/api/me/answer-stats`
- `/api/me/submit-answer`
- `/api/me/bootstrap`
- `/api/admin/*`
- `/api/passages/:id/report`
- `/api/healthz`

Feed bootstrap uses a hybrid strategy:

1. API returns a full active passage ID pool plus `40` random passage details.
2. UI stores the ID pool and marks the initial random IDs as shown.
3. UI appends future random batches from the local ID pool, excluding loaded and
   shown IDs until the pool is exhausted.
4. The database remains responsible for giving valid data; the UI owns the
   random queue experience.

The generic passage list cap is raised from `500` to `2000`. The full ID pool is
served by `/api/passages/ids`, so Feed no longer depends on high list limits.

## Consequences

- Feed randomness is no longer limited to the first ordered page of passages.
- `ORDER BY random()` is avoided for feed selection; the server samples from the
  lightweight ID pool in memory.
- Redis absence is observable through `x-cache: BYPASS` instead of misleading
  repeated `MISS` headers.
- List returns normal paginated results instead of a random subset.
