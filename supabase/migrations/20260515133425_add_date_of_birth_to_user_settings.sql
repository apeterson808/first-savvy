/*
  # Add date_of_birth to user_settings

  ## Summary
  Adds a date_of_birth column to the user_settings table for adult users.
  This is used for net worth projection calculations (age milestones on chart).

  ## Changes
  - `user_settings`: add `date_of_birth` (date, nullable for existing users)

  ## Notes
  - Nullable so existing users are not broken
  - New signups will be required to provide this at the UI level
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_settings' AND column_name = 'date_of_birth'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN date_of_birth date;
  END IF;
END $$;
