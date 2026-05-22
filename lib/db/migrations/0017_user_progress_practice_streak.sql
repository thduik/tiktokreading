ALTER TABLE user_progress
  ADD COLUMN IF NOT EXISTS current_practice_streak_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_practice_streak_days INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_practice_date_local DATE NULL;

ALTER TABLE user_progress
  DROP CONSTRAINT IF EXISTS user_progress_practice_streak_nonnegative_chk;

ALTER TABLE user_progress
  ADD CONSTRAINT user_progress_practice_streak_nonnegative_chk CHECK (
    current_practice_streak_days >= 0
    AND best_practice_streak_days >= 0
  );

UPDATE user_progress AS progress
SET last_practice_date_local = stats.last_practice_date_local
FROM (
  SELECT
    user_id,
    MAX(local_date) AS last_practice_date_local
  FROM user_daily_answer_stats
  WHERE attempt_count > 0
  GROUP BY user_id
) AS stats
WHERE progress.user_id = stats.user_id
  AND progress.last_practice_date_local IS NULL;
