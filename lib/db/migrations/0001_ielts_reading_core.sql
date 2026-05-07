CREATE TABLE IF NOT EXISTS passages (
  id TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  exam_index TEXT NOT NULL,
  exam_label TEXT NOT NULL,
  band_index INTEGER NOT NULL,
  band_label TEXT NOT NULL,
  question_set_type_index TEXT NOT NULL CHECK (
    question_set_type_index IN (
      'tfng',
      'mcq',
      'sentence_completion',
      'short_answer',
      'mixed'
    )
  ),
  question_set_type_label TEXT NOT NULL,
  topic_index TEXT NOT NULL,
  topic_label TEXT NOT NULL,
  title TEXT NOT NULL,
  language_code TEXT NOT NULL,
  status TEXT NOT NULL,
  passage TEXT NOT NULL,
  passage_meta_sentence_count INTEGER NOT NULL,
  passage_meta_word_count INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  passage_id TEXT NOT NULL REFERENCES passages(id) ON DELETE CASCADE,
  source_question_id INTEGER NOT NULL,
  order_index INTEGER NOT NULL,
  question_type_index TEXT NOT NULL CHECK (
    question_type_index IN (
      'tfng',
      'mcq',
      'sentence_completion',
      'short_answer'
    )
  ),
  question_type_label TEXT NOT NULL,
  prompt TEXT NOT NULL,
  question_payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (passage_id, source_question_id),
  UNIQUE (passage_id, order_index)
);

CREATE TABLE IF NOT EXISTS answer_keys (
  id TEXT PRIMARY KEY,
  question_id TEXT NOT NULL UNIQUE REFERENCES questions(id) ON DELETE CASCADE,
  answer_type TEXT NOT NULL CHECK (answer_type IN ('label', 'option_key', 'text')),
  answer_value TEXT NOT NULL,
  accepted_values_json JSONB NULL,
  explanation TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS passages_band_idx
  ON passages (band_index);

CREATE INDEX IF NOT EXISTS passages_question_set_type_idx
  ON passages (question_set_type_index);

CREATE INDEX IF NOT EXISTS passages_topic_idx
  ON passages (topic_index);

CREATE INDEX IF NOT EXISTS passages_status_idx
  ON passages (status);

CREATE INDEX IF NOT EXISTS passages_language_code_idx
  ON passages (language_code);

CREATE INDEX IF NOT EXISTS questions_passage_order_idx
  ON questions (passage_id, order_index);

CREATE INDEX IF NOT EXISTS questions_passage_type_idx
  ON questions (passage_id, question_type_index);

CREATE OR REPLACE FUNCTION set_row_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS passages_set_updated_at ON passages;
CREATE TRIGGER passages_set_updated_at
BEFORE UPDATE ON passages
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS questions_set_updated_at ON questions;
CREATE TRIGGER questions_set_updated_at
BEFORE UPDATE ON questions
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

DROP TRIGGER IF EXISTS answer_keys_set_updated_at ON answer_keys;
CREATE TRIGGER answer_keys_set_updated_at
BEFORE UPDATE ON answer_keys
FOR EACH ROW
EXECUTE FUNCTION set_row_updated_at();

CREATE OR REPLACE FUNCTION validate_passage_question_set_integrity(p_passage_id TEXT)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  set_type TEXT;
  total_count INTEGER;
  distinct_type_count INTEGER;
  only_type TEXT;
  has_tfng BOOLEAN;
  has_mcq BOOLEAN;
  has_sentence_completion BOOLEAN;
  has_short_answer BOOLEAN;
BEGIN
  SELECT question_set_type_index
    INTO set_type
  FROM passages
  WHERE id = p_passage_id;

  IF set_type IS NULL THEN
    RETURN;
  END IF;

  SELECT
    COUNT(*)::INTEGER,
    COUNT(DISTINCT question_type_index)::INTEGER,
    MIN(question_type_index),
    BOOL_OR(question_type_index = 'tfng'),
    BOOL_OR(question_type_index = 'mcq'),
    BOOL_OR(question_type_index = 'sentence_completion'),
    BOOL_OR(question_type_index = 'short_answer')
  INTO
    total_count,
    distinct_type_count,
    only_type,
    has_tfng,
    has_mcq,
    has_sentence_completion,
    has_short_answer
  FROM questions
  WHERE passage_id = p_passage_id;

  IF total_count = 0 THEN
    RETURN;
  END IF;

  IF set_type = 'mixed' THEN
    IF NOT COALESCE(has_tfng, FALSE)
      OR NOT COALESCE(has_mcq, FALSE)
      OR NOT COALESCE(has_sentence_completion, FALSE)
      OR NOT COALESCE(has_short_answer, FALSE)
    THEN
      RAISE EXCEPTION
        'Passage % is mixed but does not contain all required question types',
        p_passage_id;
    END IF;
  ELSE
    IF distinct_type_count <> 1 OR only_type IS DISTINCT FROM set_type THEN
      RAISE EXCEPTION
        'Passage % requires all questions to be type %, but found mismatch',
        p_passage_id,
        set_type;
    END IF;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION trigger_validate_passage_question_set_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_passage_id TEXT;
BEGIN
  target_passage_id = COALESCE(NEW.passage_id, OLD.passage_id, NEW.id, OLD.id);
  PERFORM validate_passage_question_set_integrity(target_passage_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS questions_validate_question_set ON questions;
CREATE CONSTRAINT TRIGGER questions_validate_question_set
AFTER INSERT OR UPDATE OF passage_id, question_type_index OR DELETE
ON questions
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION trigger_validate_passage_question_set_integrity();

DROP TRIGGER IF EXISTS passages_validate_question_set ON passages;
CREATE CONSTRAINT TRIGGER passages_validate_question_set
AFTER INSERT OR UPDATE OF question_set_type_index
ON passages
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION trigger_validate_passage_question_set_integrity();

CREATE OR REPLACE FUNCTION validate_answer_key_type_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  q_type TEXT;
BEGIN
  SELECT question_type_index
    INTO q_type
  FROM questions
  WHERE id = NEW.question_id;

  IF q_type IS NULL THEN
    RAISE EXCEPTION 'Question % not found for answer key', NEW.question_id;
  END IF;

  IF q_type = 'tfng' AND NEW.answer_type <> 'label' THEN
    RAISE EXCEPTION 'TFNG answer key for % must use answer_type=label', NEW.question_id;
  END IF;

  IF q_type = 'mcq' AND NEW.answer_type <> 'option_key' THEN
    RAISE EXCEPTION 'MCQ answer key for % must use answer_type=option_key', NEW.question_id;
  END IF;

  IF q_type IN ('sentence_completion', 'short_answer') AND NEW.answer_type <> 'text' THEN
    RAISE EXCEPTION 'Text question answer key for % must use answer_type=text', NEW.question_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS answer_keys_validate_answer_type ON answer_keys;
CREATE TRIGGER answer_keys_validate_answer_type
BEFORE INSERT OR UPDATE ON answer_keys
FOR EACH ROW
EXECUTE FUNCTION validate_answer_key_type_integrity();
