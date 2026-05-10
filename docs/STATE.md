# Project State

Last updated: 2026-05-10 (UTC)

## Product Snapshot

- Product: ReadTok IELTS Reading practice app.
- Primary UX:
  Feed-first passage practice with immediate answer feedback and ranked LP/XP.
- Auth:
  Clerk sign-in/sign-up integrated.
- Data:
  PostgreSQL-backed passages/questions/answer keys for production content.

## Current Frontend Behavior

- Feed route:
  `"/"` renders passage practice experience.
- List route:
  `"/list"` is the searchable/filterable passage list.
- Saved/Profile routes:
  `"/saved"` and `"/profile"` active in bottom nav.
- Mobile feed:
  Controlled left/right swipe switches passage; vertical scrolling is immediate for reading/question panels.
- Daily goal:
  `20 questions/day` shown in profile and feed header.
- Question completion ring:
  Feed header now shows subtle per-passage answered progress such as `2/8`.
- Answer reaction:
  `Correct/Missed` + LP pulse shown near answered question.
- Session summary:
  Every `10` answered questions triggers a small checkpoint summary with
  correctness, LP, XP, and accuracy.
- Feedback settings:
  Profile includes optional sound and haptics toggles for answer reactions.
- Achievements:
  V1 achievement engine is UI/local-first, with Profile progress display and
  Feed unlock toast. V2 definitions are present behind a phase flag.
- Rank identity:
  ranked LP now renders as subdivision plates such as `Bronze IV` through
  `Bronze I`, with a compact plate in Feed and a fuller plate in Profile.
- Leaderboards:
  `/leaderboard` now shows a global board plus per-rank boards sourced from
  backend `user_progress` and `user_profiles`.

## Current Backend/Data Notes

- Passage API:
  `GET /api/passages`, `GET /api/passages/ids`,
  `GET /api/passages/feed-bootstrap`, `GET /api/passages/:id`,
  `POST /api/passages/:id/report`.
- Feed sampling:
  Feed bootstrap now receives `40` random passage details plus the full active
  passage ID pool. The UI owns the random queue and excludes already-shown IDs
  locally, so Feed is no longer capped to the first ordered `500` passages.
- Redis cache policy:
  Public read-heavy data uses Redis when `REDIS_URL` is configured: passage
  lists, passage details, passage ID pools, rank tiers, and short-lived
  leaderboard rows. Private/user/admin mutation routes are intentionally not
  shared-cacheable.
- Admin reports:
  `/admin` uses env-based admin auth and reads aggregated
  `passage_report_counts` from `/api/admin/reports`.
- Ranking:
  Server accepts answer submissions and returns LP delta.
- Leaderboard API:
  `GET /api/leaderboard?scope=global|rank&rank=Bronze&limit=50` returns public
  ranked standings plus an optional signed-in viewer row.
- Answer analytics:
  Signed-in answer submissions upsert `user_daily_answer_stats` rows by
  `user + local_date + band_group + question_type`. Today, last 7 days,
  last 30 days, and lifetime stats are calculated from those daily rows.
- Synced profile stats:
  Signed-in Profile headline cards now read from `/api/me/dashboard-stats`
  instead of device-local storage. Current streak, daily goal, lifetime
  accuracy, 7-day accuracy, today's accuracy, and total questions completed are
  backend-backed for cross-device consistency. Authenticated profile stats and
  answer submission routes ensure the profile row exists before reading/writing,
  so a new device cannot miss writes while profile bootstrap is still racing.
- Production auth guard:
  On non-local hostnames, missing Clerk runtime config now shows a production
  config error instead of silently falling Profile back to local mode. The VPS
  deploy script rewrites and verifies `/var/www/readtok/runtime-config.js` after
  `rsync` so the checked-in placeholder cannot be the final live file.
- Toolchain:
  Node `20.19.5` via `.nvmrc` / `.node-version`; pnpm `10.33.2` via
  `packageManager`. Run `corepack pnpm run doctor` before build/deploy
  debugging.
- Tests:
  `corepack pnpm run test` covers ranking, answer analytics helpers, daily goal,
  rank plates, migration smoke checks, and ingest normalization.
- Passage ingestion:
  NDJSON ingest scripts with anomaly checks/fixes in DB tooling. V2 mixed-card
  ingest supports matching-style option keys beyond `D`.
- Backups:
  Daily PostgreSQL backup script exists for S3-compatible storage.

## Operational Reality

- Live site:
  `https://ieltstok.online`
- VPS shape:
  repo at `/opt/readtok`, frontend webroot at `/var/www/readtok`.
- Deployment:
  Build on VPS and publish static bundle to Nginx webroot.

## Known Constraints

- Some build logs include non-blocking source-map warnings from upstream packages.
- Frontend state is intentionally local-first for gamification UX speed.
- Achievement unlocks are local-device only until backend persistence is added.
- Answer analytics are backend-backed for signed-in users only; local mode still
  uses local Profile counters.
- Agent sessions should use docs in this directory as source of truth, not removed legacy files.

## Next Priorities

1. Use answer analytics for a lightweight "Next Best Practice" suggestion.
2. Optional backend persistence for achievement snapshots/unlocks.
3. Mistakes flow or lightweight mistake-saving layer.
4. Restore production `REDIS_URL` and verify live `x-cache` headers show
   `MISS -> HIT` for cacheable endpoints.
