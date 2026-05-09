CREATE TABLE IF NOT EXISTS user_daily_answer_stats (
  user_id TEXT NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  local_date DATE NOT NULL,
  band_group TEXT NOT NULL,
  question_type TEXT NOT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  wrong_count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  PRIMARY KEY (user_id, local_date, band_group, question_type),
  CONSTRAINT user_daily_answer_stats_counts_nonnegative_chk CHECK (
    attempt_count >= 0 AND correct_count >= 0 AND wrong_count >= 0
  ),
  CONSTRAINT user_daily_answer_stats_counts_match_chk CHECK (
    attempt_count = correct_count + wrong_count
  ),
  CONSTRAINT user_daily_answer_stats_band_group_chk CHECK (
    band_group IN ('Band6', 'Band7', 'Band75', 'Band8Plus')
  ),
  CONSTRAINT user_daily_answer_stats_question_type_chk CHECK (
    question_type IN ('MCQ', 'TFNG', 'SentenceCompletion', 'ShortAnswer', 'Matching')
  )
);

CREATE INDEX IF NOT EXISTS user_daily_answer_stats_user_date_idx
  ON user_daily_answer_stats(user_id, local_date);

CREATE INDEX IF NOT EXISTS user_daily_answer_stats_user_category_idx
  ON user_daily_answer_stats(user_id, band_group, question_type);
