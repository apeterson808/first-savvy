/*
  # Add plain text PIN field for parent viewing

  1. Changes
    - Add `pin_plaintext` column to `child_profiles` table for parents to view their child's PIN
    - This is separate from `pin_hash` used for authentication
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'child_profiles' AND column_name = 'pin_plaintext'
  ) THEN
    ALTER TABLE child_profiles ADD COLUMN pin_plaintext text;
  END IF;
END $$;
