/*
  # Add First and Last Name Fields to User Settings

  1. Changes
    - Add `first_name` column to user_settings table
    - Add `last_name` column to user_settings table
    - Migrate existing full_name data to first_name and last_name
    - Keep full_name column for backward compatibility

  2. Notes
    - Splits existing full_name on first space
    - First word becomes first_name, rest becomes last_name
    - If no space, entire name goes to first_name
*/

-- Add first_name and last_name columns
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS first_name TEXT,
ADD COLUMN IF NOT EXISTS last_name TEXT;

-- Migrate existing full_name data
UPDATE user_settings
SET 
  first_name = CASE 
    WHEN position(' ' in full_name) > 0 
    THEN split_part(full_name, ' ', 1)
    ELSE full_name
  END,
  last_name = CASE 
    WHEN position(' ' in full_name) > 0 
    THEN substring(full_name from position(' ' in full_name) + 1)
    ELSE ''
  END
WHERE first_name IS NULL;