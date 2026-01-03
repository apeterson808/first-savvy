/*
  # Fix Profile Tabs Schema

  ## Overview
  This migration fixes the profile_tabs schema to properly integrate with the profiles system.

  ## Changes Made

  ### 1. Add profile_id column to profile_tabs
  - Adds `profile_id` column that references profiles table
  - Migrates existing data based on profile_user_id

  ### 2. Add display_name column to profile_tabs
  - Adds `display_name` column for tab display

  ### 3. Update foreign key constraints
  - Creates proper relationship between profile_tabs and profiles

  ## Important Notes
  - Existing profile_tabs records will be updated to reference correct profile
  - Any tabs without matching profiles will need to be recreated
*/

-- Add profile_id column to profile_tabs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profile_tabs'
    AND column_name = 'profile_id'
  ) THEN
    ALTER TABLE profile_tabs 
    ADD COLUMN profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add display_name column to profile_tabs
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profile_tabs'
    AND column_name = 'display_name'
  ) THEN
    ALTER TABLE profile_tabs 
    ADD COLUMN display_name text;
  END IF;
END $$;

-- Migrate existing profile_tabs to use profile_id
UPDATE profile_tabs pt
SET profile_id = p.id
FROM profiles p
WHERE p.user_id = pt.profile_user_id
  AND pt.profile_id IS NULL;

-- Update display_name from profiles
UPDATE profile_tabs pt
SET display_name = p.display_name
FROM profiles p
WHERE pt.profile_id = p.id
  AND pt.display_name IS NULL;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_profile_tabs_profile_id ON profile_tabs(profile_id);
