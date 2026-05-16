CREATE TABLE IF NOT EXISTS user_question_timing_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  passage_id TEXT NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
  question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  source_question_id INTEGER NOT NULL,
  display_position INTEGER NOT NULL,
  elapsed_seconds INTEGER NOT NULL,
  local_date DATE NOT NULL,
  is_correct BOOLEAN NOT NULL,
  band_group TEXT NOT NULL,
  question_type TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (elapsed_seconds >= 0 AND elapsed_seconds <= 14400),
  CHECK (display_position >= 1),
  CHECK (band_group IN ('Band6', 'Band7', 'Band75', 'Band8Plus')),
  CHECK (question_type IN ('MCQ', 'TFNG', 'SentenceCompletion', 'ShortAnswer', 'Matching'))
);

CREATE INDEX IF NOT EXISTS user_question_timing_events_user_date_idx
  ON user_question_timing_events (user_id, local_date);

CREATE INDEX IF NOT EXISTS user_question_timing_events_user_passage_created_idx
  ON user_question_timing_events (user_id, passage_id, created_at);

CREATE INDEX IF NOT EXISTS user_question_timing_events_passage_position_idx
  ON user_question_timing_events (passage_id, display_position);
