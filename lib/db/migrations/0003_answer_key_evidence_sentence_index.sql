ALTER TABLE answer_keys
ADD COLUMN IF NOT EXISTS evidence_json JSONB NOT NULL DEFAULT '[]'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'answer_keys_evidence_json_array_chk'
  ) THEN
    ALTER TABLE answer_keys
    ADD CONSTRAINT answer_keys_evidence_json_array_chk
    CHECK (jsonb_typeof(evidence_json) = 'array');
  END IF;
END $$;
