/*
  # Add gender field to child profiles

  1. Changes
    - Add `gender` column to `child_profiles` table
    - Gender can be 'male', 'female', 'other', or null
    - No RLS changes needed (inherits from existing policies)
*/

-- Add gender column to child_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'child_profiles' AND column_name = 'gender'
  ) THEN
    ALTER TABLE child_profiles ADD COLUMN gender text CHECK (gender IN ('male', 'female', 'other'));
  END IF;
END $$;
