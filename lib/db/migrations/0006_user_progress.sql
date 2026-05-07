CREATE TABLE IF NOT EXISTS user_progress (
  user_id TEXT PRIMARY KEY REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  lifetime_xp INTEGER NOT NULL DEFAULT 0,
  ranked_points INTEGER NOT NULL DEFAULT 0,
  current_rank TEXT NOT NULL DEFAULT 'Bronze',
  total_questions_answered INTEGER NOT NULL DEFAULT 0,
  total_correct INTEGER NOT NULL DEFAULT 0,
  total_incorrect INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_progress_lifetime_xp_nonnegative_chk CHECK (lifetime_xp >= 0),
  CONSTRAINT user_progress_ranked_points_nonnegative_chk CHECK (ranked_points >= 0),
  CONSTRAINT user_progress_totals_nonnegative_chk CHECK (
    total_questions_answered >= 0
    AND total_correct >= 0
    AND total_incorrect >= 0
  ),
  CONSTRAINT user_progress_current_rank_chk CHECK (
    current_rank in (
      'Bronze',
      'Silver',
      'Gold',
      'Platinum',
      'Diamond',
      'Master',
      'Grandmaster',
      'Challenger'
    )
  )
);
