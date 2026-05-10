CREATE TABLE IF NOT EXISTS user_vocab_bank (
  user_id TEXT NOT NULL REFERENCES user_profiles(user_id) ON DELETE CASCADE,
  normalized_term TEXT NOT NULL,
  term TEXT NOT NULL,
  meaning_en TEXT NULL,
  meaning_vi TEXT NULL,
  example_sentence_en TEXT NULL,
  sentence_index INTEGER NULL,
  source_passage_id TEXT NULL REFERENCES passages(id) ON DELETE SET NULL,
  source_passage_title TEXT NULL,
  source_band_label TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_vocab_bank_pkey PRIMARY KEY (user_id, normalized_term),
  CONSTRAINT user_vocab_bank_term_nonempty_chk CHECK (length(trim(term)) > 0),
  CONSTRAINT user_vocab_bank_normalized_term_nonempty_chk CHECK (
    length(trim(normalized_term)) > 0
  ),
  CONSTRAINT user_vocab_bank_sentence_index_positive_chk CHECK (
    sentence_index IS NULL OR sentence_index >= 1
  )
);

CREATE INDEX IF NOT EXISTS user_vocab_bank_user_created_idx
  ON user_vocab_bank(user_id, created_at);

DROP TRIGGER IF EXISTS user_vocab_bank_set_updated_at ON user_vocab_bank;
CREATE TRIGGER user_vocab_bank_set_updated_at
BEFORE UPDATE ON user_vocab_bank
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();
