/*
  # Add Profile Type Column to User Profiles

  1. Changes
    - Add `profile_type` column to `user_profiles` table
      - Type: text, default 'personal'
      - Values: 'personal' or 'business'
      - All existing users default to 'personal'

  2. Performance
    - Add index on profile_type for efficient filtering

  3. Important Notes
    - This prepares infrastructure for future business profile support
    - Profile type determines which account types and detail types are available
    - All existing users automatically get 'personal' profile type
*/

-- Add profile_type column to existing user_profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_profiles'
    AND column_name = 'profile_type'
  ) THEN
    ALTER TABLE user_profiles
    ADD COLUMN profile_type text NOT NULL DEFAULT 'personal'
    CHECK (profile_type IN ('personal', 'business'));
  END IF;
END $$;

-- Create index on profile_type for future filtering
CREATE INDEX IF NOT EXISTS idx_user_profiles_profile_type ON user_profiles(profile_type);

-- Update all existing users to have 'personal' profile type (redundant but explicit)
UPDATE user_profiles
SET profile_type = 'personal'
WHERE profile_type IS NULL;