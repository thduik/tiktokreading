# Achievement System

## Current Status

- Implementation mode: UI/local-first.
- Active phase: `v1`.
- Definition source: `artifacts/readtok/src/lib/achievements.ts`.
- Local unlock storage:
  `readtok_stats.achievementProgress.unlockedAchievementKeys`.
- Backend persistence:
  not required for the current ship; see `docs/adr/0002-ui-first-achievements.md`.

## Naming Rule

Achievement titles shown to users must use the full family+tier name.

Examples:

- Good: `Combo Chain Mythic`
- Good: `Daily Quest Clockwork`
- Avoid: `Mythic`

This keeps achievements readable, searchable, and easier to reason about in logs/UI.

## Active V1 Families

- `First Quest / Quest Grinder`:
  total questions answered.
- `Answer Slayer`:
  total correct answers.
- `Combo Chain`:
  best correct-answer streak.
- `Daily Quest`:
  daily goal completions.
- `Login Streak`:
  practice days in a row.
- `Ranked Climber`:
  highest reached rank by LP.
- `Knowledge Vault`:
  saved passages.
- `Mode Completionist`:
  coverage across question types.
- `Difficulty Completionist`:
  coverage across band groups.

## V2 Definitions Already Prepared

V2 definitions exist behind the `phase: "v2"` flag and are not unlocked by the current UI pass.

- Lifetime accuracy.
- Rolling accuracy windows: `last20`, `last50`, `last100`.
- Question type mastery.
- Question type accuracy.
- Band-level grinding.
- LP momentum.
- Comeback and damage-control achievements.
- Bug Hunter report achievements.
- Time-based achievements.

## Progress Counters

Progress is stored under `UserAchievementProgress`.

Important counters:

- `totalQuestionsAnswered`, `totalCorrectAnswers`, `totalWrongAnswers`.
- `currentCorrectStreak`, `bestCorrectStreak`.
- `currentWrongStreak`, `lastWrongStreakBeforeRecovery`,
  `currentRecoveryCorrectStreak`, `damageControlCount`.
- `dailyGoalHits`, `dailyAnsweredCount`, `lastDailyGoalDateLocal`.
- `currentPracticeStreakDays`, `bestPracticeStreakDays`.
- `questionTypeAttempts`, `questionTypeCorrect`.
- `bandAttempts`, `bandCorrect`.
- `currentRank`, `currentLP`, `dailyLPGained`, `bestSingleDayLPGain`.
- `savedPassageCount`, `reportCount`.
- `rollingWindows.last20`, `rollingWindows.last50`, `rollingWindows.last100`.

## Event Mechanics

### Answer Submitted

Called from the normal answer reveal flow.

Updates:

- total answered/correct/wrong counters.
- daily stats and practice streak.
- correct streak and wrong streak.
- comeback counters.
- question type counters.
- band group counters.
- rolling windows.
- time-of-day counters.

Then checks V1 achievements with trigger:

`ANSWER_SUBMITTED`

If the daily goal crosses `20 questions` for the local date, it also checks:

`DAILY_GOAL_COMPLETED`

### Ranked Result

Called after `/me/submit-answer` returns.

Updates:

- `currentRank`.
- `currentLP`.
- positive-only daily LP gain.
- best single-day LP gain.

Then checks:

- `RANK_UPDATED`
- `LP_GAINED` if LP delta is positive

### Passage Saved

Called when a passage is newly saved.

Updates:

- `savedPassageCount` as the highest known saved-count value.

Then checks:

`PASSAGE_SAVED`

### Report Submitted

Called only after the official report API succeeds.

Updates:

- `reportCount`.

Then checks:

`REPORT_SUBMITTED`

Report achievements are V2-gated for now.

## Normalization

Question type normalization:

- `mcq`, `multiple_choice` => `MCQ`
- `tfng`, `true_false_not_given` => `TFNG`
- `sentence_completion` => `SentenceCompletion`
- `short_answer` => `ShortAnswer`
- `matching`, `matching_heading`, `matching_information` => `Matching`

Band group normalization:

- `6`, `6.0`, `Band 6.0` => `Band6`
- `7`, `7.0`, `Band 7.0` => `Band7`
- `7.5`, `Band 7.5` => `Band75`
- `8`, `8.0`, `8.0+`, `Band 8.0+` => `Band8Plus`

## Rolling Window Mechanism

Rolling windows store compact strings:

- `R` = correct answer
- `W` = wrong answer

Each new answer appends one character and trims the string:

- `last20`: max 20 chars
- `last50`: max 50 chars
- `last100`: max 100 chars

Accuracy is calculated from the string at evaluation time.

This is intentionally simple and local-first. If backend persistence is added later,
the same compact strings can be stored as text columns or reconstructed from an
answer-attempt event table.

## Future DB Shape

When cross-device achievement persistence is needed, add:

```sql
CREATE TABLE user_achievements (
  user_id text NOT NULL,
  achievement_key text NOT NULL,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_key)
);
```

Progress can be stored either as explicit columns or as a JSON snapshot. If the
app needs auditability for rolling windows and achievement replays, add a
`user_answer_attempts` event table instead of only storing aggregate counters.
