CREATE TABLE IF NOT EXISTS user_achievements (
  user_id TEXT NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  achievement_key TEXT NOT NULL,
  achievement_title TEXT NOT NULL,
  achievement_category TEXT NOT NULL,
  achievement_tier TEXT NOT NULL,
  achievement_xp INTEGER NOT NULL DEFAULT 0,
  unlocked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_achievements_pkey PRIMARY KEY (user_id, achievement_key),
  CONSTRAINT user_achievements_key_nonempty_chk CHECK (
    length(trim(achievement_key)) > 0
  ),
  CONSTRAINT user_achievements_title_nonempty_chk CHECK (
    length(trim(achievement_title)) > 0
  ),
  CONSTRAINT user_achievements_tier_nonempty_chk CHECK (
    length(trim(achievement_tier)) > 0
  ),
  CONSTRAINT user_achievements_xp_nonnegative_chk CHECK (
    achievement_xp >= 0
  )
);

CREATE INDEX IF NOT EXISTS user_achievements_user_unlocked_idx
  ON user_achievements(user_id, unlocked_at);

CREATE INDEX IF NOT EXISTS user_achievements_user_category_idx
  ON user_achievements(user_id, achievement_category);

DROP TRIGGER IF EXISTS user_achievements_set_updated_at ON user_achievements;
CREATE TRIGGER user_achievements_set_updated_at
BEFORE UPDATE ON user_achievements
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();
