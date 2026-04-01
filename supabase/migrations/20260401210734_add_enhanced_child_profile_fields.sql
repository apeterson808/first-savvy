/*
  # Add Enhanced Child Profile Fields for 3-Tier System

  ## Overview
  This migration adds enhanced fields to child profiles to support comprehensive
  child information capture including first name, last name, sex, and avatar.
  It also constrains permission levels to 3 tiers and migrates existing data.

  ## Changes
  
  1. New Columns Added to `child_profiles`:
    - `first_name` (text, nullable initially for existing records)
    - `last_name` (text, nullable initially for existing records)
    - `sex` (text, nullable, valid values: 'male', 'female', 'other', 'prefer_not_to_say')
    - Note: `avatar_url` already exists, so we won't add it
  
  2. Constraint Updates:
    - Update permission level constraint to only allow 1-3 (3-tier system)
    - Add CHECK constraint for sex field
  
  3. Data Migration:
    - Split existing `child_name` into `first_name` and `last_name`
    - Downgrade any level 4 or 5 profiles to level 3
  
  ## Important Notes
  - Existing records will have `first_name` and `last_name` populated from `child_name`
  - New records should provide `first_name` and `last_name` explicitly
  - Sex field remains optional for privacy
  - Avatar URL already exists in schema
*/

-- Add new columns to child_profiles
ALTER TABLE child_profiles
ADD COLUMN IF NOT EXISTS first_name text,
ADD COLUMN IF NOT EXISTS last_name text,
ADD COLUMN IF NOT EXISTS sex text;

-- Add CHECK constraint for sex field
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'child_profiles_sex_check'
  ) THEN
    ALTER TABLE child_profiles
    ADD CONSTRAINT child_profiles_sex_check 
    CHECK (sex IS NULL OR sex IN ('male', 'female', 'other', 'prefer_not_to_say'));
  END IF;
END $$;

-- Migrate existing data: split child_name into first_name and last_name
UPDATE child_profiles
SET 
  first_name = CASE 
    WHEN position(' ' in child_name) > 0 
    THEN substring(child_name from 1 for position(' ' in child_name) - 1)
    ELSE child_name
  END,
  last_name = CASE 
    WHEN position(' ' in child_name) > 0 
    THEN substring(child_name from position(' ' in child_name) + 1)
    ELSE ''
  END
WHERE first_name IS NULL;

-- Downgrade any level 4 or 5 profiles to level 3 (3-tier system max)
UPDATE child_profiles
SET current_permission_level = 3
WHERE current_permission_level > 3;

-- Drop the old permission level constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'child_profiles_current_permission_level_check'
  ) THEN
    ALTER TABLE child_profiles
    DROP CONSTRAINT child_profiles_current_permission_level_check;
  END IF;
END $$;

-- Add new 3-tier permission level constraint
ALTER TABLE child_profiles
ADD CONSTRAINT child_profiles_current_permission_level_check 
CHECK (current_permission_level BETWEEN 1 AND 3);

-- Create index on first_name and last_name for faster lookups
CREATE INDEX IF NOT EXISTS idx_child_profiles_first_name ON child_profiles(first_name);
CREATE INDEX IF NOT EXISTS idx_child_profiles_last_name ON child_profiles(last_name);