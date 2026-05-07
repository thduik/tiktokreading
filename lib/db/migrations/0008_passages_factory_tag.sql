ALTER TABLE passages
ADD COLUMN IF NOT EXISTS factory_tag TEXT;

UPDATE passages
SET factory_tag = 'v1'
WHERE factory_tag IS NULL OR btrim(factory_tag) = '';

ALTER TABLE passages
ALTER COLUMN factory_tag SET DEFAULT 'v1';

ALTER TABLE passages
ALTER COLUMN factory_tag SET NOT NULL;

CREATE INDEX IF NOT EXISTS passages_factory_tag_idx
  ON passages (factory_tag);
