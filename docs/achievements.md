# Achievement System

## Current Status

- Definitions source:
  `/Users/linhnguyen/Documents/New project 2/tiktokreadingv1/artifacts/readtok/src/lib/achievements.ts`
- Active unlock phase:
  `v1` shipped, `v2` definitions still gated.
- Source of truth:
  - signed-in users: backend `user_achievements` plus `/api/me/achievements`
  - local/no-auth mode: `readtok_stats.achievementProgress.unlockedAchievementKeys`
- Public display:
  leaderboard user detail panels can show unlocked achievements and achievement XP
  through public-safe API payloads.

## What Is Backend-Synced Now

For signed-in users, achievement unlocks are no longer local-device only.

Backend persistence:

```sql
user_achievements
- user_id
- achievement_key
- achievement_title
- achievement_category
- achievement_tier
- achievement_xp
- unlocked_at
```

Uniqueness:

```sql
UNIQUE(user_id, achievement_key)
```

This means:

- unlocked achievements should survive device switches
- profile achievement XP/level is backend-derived for authenticated users
- leaderboard public profile views can safely expose unlocked achievements
  without leaking private account identifiers

## Naming Rule

Achievement titles shown to users must use the full family+tier name.

Examples:

- Good: `Combo Chain Mythic`
- Good: `Daily Quest Clockwork`
- Avoid: `Mythic`

## Active V1 Families

- `First Quest / Quest Grinder`:
  total questions answered
- `Answer Slayer`:
  total correct answers
- `Combo Chain`:
  best correct-answer streak
- `Daily Quest`:
  daily quest / goal completions
- `Login Streak`:
  practice days in a row
- `Ranked Climber`:
  highest reached rank by LP
- `Knowledge Vault`:
  saved passages
- `Mode Completionist`:
  coverage across question types
- `Difficulty Completionist`:
  coverage across band groups

## V2 Definitions Still Gated

Definitions already exist in code, but they are not fully surfaced as the
shipping unlock set yet.

- Lifetime accuracy
- Rolling window accuracy
- Question type mastery
- Question type accuracy
- Band-level grind achievements
- LP momentum
- Comeback / damage-control achievements
- Report / QA achievements
- Time-based achievements

## Progress Counters

Frontend achievement evaluation still relies on `UserAchievementProgress`.

Important counters:

- `totalQuestionsAnswered`, `totalCorrectAnswers`, `totalWrongAnswers`
- `currentCorrectStreak`, `bestCorrectStreak`
- `currentWrongStreak`, `lastWrongStreakBeforeRecovery`,
  `currentRecoveryCorrectStreak`, `damageControlCount`
- `dailyGoalHits`, `dailyAnsweredCount`, `lastDailyGoalDateLocal`
- `currentPracticeStreakDays`, `bestPracticeStreakDays`
- `questionTypeAttempts`, `questionTypeCorrect`
- `bandAttempts`, `bandCorrect`
- `currentRank`, `currentLP`, `dailyLPGained`, `bestSingleDayLPGain`
- `savedPassageCount`, `reportCount`
- rolling windows for short-term accuracy checks

## Event Mechanics

### Answer Submitted

The normal answer flow updates frontend progress counters immediately for UI
responsiveness, then signed-in mode can sync unlock batches to the backend.

Updates:

- total answered/correct/wrong counters
- daily stats and practice streak
- correct streak / wrong streak
- comeback counters
- question type counters
- band group counters
- rolling windows

### Ranked Result

Called after `/api/me/submit-answer` returns.

Updates:

- `currentRank`
- `currentLP`
- positive-only daily LP gain
- best single-day LP gain

### Passage Saved

Called when a passage is newly saved.

Updates:

- `savedPassageCount`

### Report Submitted

Called only after the official report API succeeds.

Updates:

- `reportCount`

## Achievement XP and Level

Signed-in profile level for achievements is backend-backed from unlocked
achievement rows:

- total achievement XP = sum of unlocked `achievement_xp`
- current achievement level = threshold lookup from total XP

That value should be treated as the canonical profile display when authenticated.

## Public Identity

Achievement-related public views must use `user_profiles.public_user_id`, not
raw Clerk user IDs.

## Operational Rule

If a future feature changes unlock criteria, update both:

1. the frontend achievement definitions / logic
2. this document and any public API payload docs that expose achievement data
