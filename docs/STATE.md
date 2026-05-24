# Project State

Last updated: 2026-05-14 (UTC)

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
- Desktop feed:
  Left/right arrow keys switch passages when focus is not inside an input, textarea,
  select, contenteditable area, or open feed dialog.
- Feed startup backups:
  Feed now uses a very small two-step startup fallback instead of persisting
  the whole random stack in browser storage. First, a resume snapshot stores
  the exact real passage the user is currently reading, with answer/timer
  state, and can reopen it for up to `5` minutes after a crash or refresh. The
  resume snapshot updates immediately when the displayed passage changes, so
  every swipe rewrites the exact resume target. If that short-lived snapshot is
  unavailable, Feed falls back to one of `5` bundled cold-backup passages so
  the screen never starts blank even if the API is unavailable. In every case,
  the live feed bootstrap still runs in parallel and replaces the preview as
  soon as fresh API data arrives.
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
  Unlock definitions still live in the frontend, but signed-in unlocks now sync
  to backend `user_achievements`. Profile and leaderboard achievement views
  should treat the API as the source of truth for unlocked achievements and XP.
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
- Passage cache versioning:
  client passage list/detail caches no longer rely on manual hardcoded version
  bumps. The frontend derives a cache namespace from `/api/passages/ids` or
  `/api/passages/feed-bootstrap` `version` values and stores cache entries under
  that namespace.
- Passage version filter:
  the List UI intentionally exposes both exact current buckets such as `v5.5`
  and `v6`
  and an open-ended `v5+` bucket. The API resolves `v5+` to every passage
  `factory_tag` at `v5` or above, so future `v6`, `v7`, and later passage
  batches should appear there without a new frontend filter release.
- Redis cache policy:
  Public read-heavy data uses Redis when `REDIS_URL` is configured: passage
  lists, passage details, passage ID pools, rank tiers, and short-lived
  leaderboard rows. Private/user/admin mutation routes are intentionally not
  shared-cacheable.
- DB change workflow rule:
  any DB development that changes shape, semantics, or read/write behavior must
  ship with the corresponding Redis/cache-key, invalidation, and API payload
  updates in the same task. We do not treat database-only changes as complete
  if cached readers can still serve stale structure or stale meaning.
- Public identity:
  leaderboard and public user profile lookups use `user_profiles.public_user_id`
  instead of exposing raw Clerk IDs.
- Admin reports:
  `/admin` uses env-based admin auth and reads aggregated
  `passage_report_counts` from `/api/admin/reports`.
- Passage report feedback:
  the passage report flow still increments aggregate type counts, and it can now
  optionally persist up to `500` characters of freeform `custom_feedback` per
  submission in `passage_report_feedback`. The frontend exposes both
  `questions_too_easy` and `questions_too_hard` issue types.
- Ranking:
  Server accepts answer submissions and returns LP delta.
- Leaderboard API:
  `GET /api/leaderboard?scope=global|rank&rank=Bronze&limit=50` returns public
  ranked standings plus an optional signed-in viewer row.
- Answer analytics:
  Signed-in answer submissions upsert `user_daily_answer_stats` rows by
  `user + local_date + band_group + question_type`. Today, last 7 days,
  last 30 days, and lifetime stats are calculated from those daily rows.
- Question timing:
  signed-in answer submissions can also append `user_question_timing_events`
  with `elapsed_seconds` and visible `display_position`. `/api/me/question-timing-summary`
  aggregates those events for profile pacing views.
- Synced profile stats:
  Signed-in Profile headline cards now read from `/api/me/dashboard-stats`
  instead of device-local storage. Current streak, daily goal, lifetime
  accuracy, 7-day accuracy, today's accuracy, and total questions completed are
  backend-backed for cross-device consistency. Authenticated profile stats and
  answer submission routes ensure the profile row exists before reading/writing,
  so a new device cannot miss writes while profile bootstrap is still racing.
- Practice streak rule:
  `user_progress` now owns explicit streak state with
  `current_practice_streak_days`, `best_practice_streak_days`, and
  `last_practice_date_local`. The dashboard shows the stored streak as long as
  the user returns within `3` full missed local days; on the next practiced day
  after that grace window, the streak resets to `1`. The submit-answer response
  also returns `current_streak_days` so frontend profile caches can patch
  immediately after a write instead of waiting for a dashboard reread.
- Local-vs-server state boundary:
  for hosted auth mode, backend-owned user state must not be persisted in
  browser localStorage. `use-app-state` now treats only onboarding flags, feed
  runtime/session preferences, feedback settings, saved IDs, and local-only
  mistake/session UX as client-owned.
- API contracts:
  `lib/api-spec/openapi.yaml` now documents the main production surface
  (`/me`, `/passages`, `/leaderboard`, vocab, achievements, timing, reports),
  and Orval generation targets `lib/api-client-react` plus `lib/api-zod`.
- Production auth guard:
  On non-local hostnames, missing Clerk runtime config now shows a production
  config error instead of silently falling Profile back to local mode. The VPS
  deploy script rewrites and verifies `/var/www/readtok/runtime-config.js` after
  `rsync` so the checked-in placeholder cannot be the final live file.
- Production Nginx hardening:
  `ops/nginx/readtok.conf` includes the first app-layer abuse/DDoS baseline:
  per-IP request budgets for global/API/write routes, `100` global and `50` API
  concurrent-connection caps, `10s` header/body timeouts, `15s` keepalive, and a
  `1m` max request body. These protect against simple floods and slow/oversized
  requests; volumetric DDoS still needs provider/CDN protection.
- Toolchain:
  Node `20.19.5` via `.nvmrc` / `.node-version`; pnpm `10.33.2` via
  `packageManager`. Run `corepack pnpm run doctor` before build/deploy
  debugging.
- Tests:
  `corepack pnpm run test` covers ranking, answer analytics helpers, daily goal,
  rank plates, passage feed runtime helpers, profile-store helpers, migration
  smoke checks, and ingest normalization.
- Passage ingestion:
  NDJSON ingest scripts with anomaly checks/fixes in DB tooling. V2 mixed-card
  ingest supports matching-style option keys beyond `D`. Multi-answer MCQ keys
  such as `B and D` are now preserved canonically as `B, D` instead of being
  flattened to a single option. Historical `v5+` passages that were flattened
  before this fix can be repaired in place with
  `repair-v5-plus-multi-key-mcq.ts`, which also bumps passage `updated_at` so
  frontend content namespaces rotate and invalidates passage Redis caches before
  the search catalog is rewarmed. The `v6.5` production batches were ingested
  on 2026-05-24 as `v6_5`. The default `factory_tag` baseline is now `v7_0`;
  confirm the next content-machine tag explicitly before each import.
- Backups:
  Daily PostgreSQL backup script exists for S3-compatible storage.

## Operational Reality

- Live site:
  `https://ieltstok.online`
- VPS shape:
  repo at `/opt/readtok`, frontend webroot at `/var/www/readtok`.
- Current production host:
  `root@103.69.97.207`
- Deployment:
  Build on VPS and publish static bundle to Nginx webroot.

## Known Constraints

- Some build logs include non-blocking source-map warnings from upstream packages.
- Some UX/session state remains intentionally local-first for responsiveness,
  but signed-in profile/achievement/rank data should be treated as backend-owned.
- Answer analytics are backend-backed for signed-in users only; local mode still
  uses local Profile counters and should be considered best-effort only.
- Agent sessions should use docs in this directory as source of truth, not removed legacy files.
- "Live" means verified on the current production host, current webroot bundle,
  and current live origin. Local code, GitHub push, or a partial deploy log are
  not enough on their own.

## Next Priorities

1. Add API integration tests for `/api/me/submit-answer`, dashboard stats, and
   leaderboard public profile stats.
2. Add Playwright smoke coverage for feed open, answer submit, profile load,
   and leaderboard floating detail.
3. Continue splitting `passage-detail.tsx` and `routes/me.ts` into narrower
   services/hooks now that shared helpers are extracted.
4. Restore production `REDIS_URL` and verify live `x-cache` headers show
   `MISS -> HIT` for cacheable endpoints.
