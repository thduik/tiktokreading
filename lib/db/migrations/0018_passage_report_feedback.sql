CREATE TABLE IF NOT EXISTS passage_report_feedback (
  id TEXT PRIMARY KEY,
  passage_id TEXT NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  custom_feedback TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT passage_report_feedback_length_chk CHECK (
    char_length(custom_feedback) >= 1
    AND char_length(custom_feedback) <= 500
  )
);

CREATE INDEX IF NOT EXISTS passage_report_feedback_passage_idx
  ON passage_report_feedback (passage_id, created_at);
