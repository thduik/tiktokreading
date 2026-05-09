# Project State

Last updated: 2026-05-08 (UTC)

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

## Current Backend/Data Notes

- Passage API:
  `GET /api/passages`, `GET /api/passages/:id`, `POST /api/passages/:id/report`.
- Admin reports:
  `/admin` uses env-based admin auth and reads aggregated
  `passage_report_counts` from `/api/admin/reports`.
- Ranking:
  Server accepts answer submissions and returns LP delta.
- Answer analytics:
  Signed-in answer submissions upsert `user_daily_answer_stats` rows by
  `user + local_date + band_group + question_type`. Today, last 7 days,
  last 30 days, and lifetime stats are calculated from those daily rows.
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
