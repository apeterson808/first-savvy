/*
  # Add first and last name fields to child profiles

  1. Changes
    - Add `first_name` and `last_name` columns to `child_profiles` table
    - Migrate existing `child_name` data to `first_name`
    - Keep `child_name` for backward compatibility (computed column or maintain both)
*/

-- Add first_name and last_name columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'child_profiles' AND column_name = 'first_name'
  ) THEN
    ALTER TABLE child_profiles ADD COLUMN first_name text;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'child_profiles' AND column_name = 'last_name'
  ) THEN
    ALTER TABLE child_profiles ADD COLUMN last_name text;
  END IF;
END $$;

-- Migrate existing child_name data to first_name (split on first space)
UPDATE child_profiles
SET 
  first_name = COALESCE(split_part(child_name, ' ', 1), child_name),
  last_name = CASE 
    WHEN position(' ' IN child_name) > 0 
    THEN substring(child_name FROM position(' ' IN child_name) + 1)
    ELSE ''
  END
WHERE first_name IS NULL;
