ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS public_user_id TEXT;

UPDATE user_profiles
SET public_user_id = CONCAT('reader_', SUBSTRING(md5(user_id) FROM 1 FOR 12))
WHERE public_user_id IS NULL OR length(trim(public_user_id)) = 0;

ALTER TABLE user_profiles
  ALTER COLUMN public_user_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_public_user_id_uidx
  ON user_profiles (public_user_id);
