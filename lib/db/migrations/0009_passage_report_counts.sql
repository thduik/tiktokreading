CREATE TABLE IF NOT EXISTS passage_report_counts (
  passage_id TEXT NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
  report_type TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT passage_report_counts_passage_type_uidx UNIQUE (passage_id, report_type),
  CONSTRAINT passage_report_counts_nonnegative_chk CHECK (count >= 0)
);

CREATE INDEX IF NOT EXISTS passage_report_counts_passage_idx
  ON passage_report_counts (passage_id);
