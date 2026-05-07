ALTER TABLE passages
ADD COLUMN IF NOT EXISTS vocab_json JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'passages_vocab_json_array_chk'
  ) THEN
    ALTER TABLE passages
    ADD CONSTRAINT passages_vocab_json_array_chk
    CHECK (jsonb_typeof(vocab_json) = 'array');
  END IF;
END $$;

