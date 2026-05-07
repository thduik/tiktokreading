CREATE OR REPLACE FUNCTION trigger_validate_passage_question_set_integrity()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  target_passage_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'questions' THEN
    target_passage_id = COALESCE(NEW.passage_id, OLD.passage_id);
  ELSE
    target_passage_id = COALESCE(NEW.id, OLD.id);
  END IF;

  PERFORM validate_passage_question_set_integrity(target_passage_id);
  RETURN NULL;
END;
$$;
