/*
  # Remove Pin Feature and Add Tab Display Name

  ## Overview
  This migration removes the pin feature from profile tabs and adds customizable tab display names.

  ## Changes Made

  ### 1. Remove Pin Feature from profile_tabs
  - Drop `is_pinned` column from profile_tabs table
  - Remove all pin-related logic and constraints

  ### 2. Add Tab Display Name to user_profiles
  - Add `tab_display_name` column to user_profiles table
  - Users can customize how their profile appears in tabs
  - Defaults to NULL (will fall back to first name)

  ## Important Notes
  - Existing tabs will no longer have pin state
  - All tabs can now be closed (no more pinned tab restrictions)
  - Tab names are now independent and customizable through settings
*/

-- Remove is_pinned column from profile_tabs
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profile_tabs'
    AND column_name = 'is_pinned'
  ) THEN
    ALTER TABLE profile_tabs DROP COLUMN is_pinned;
  END IF;
END $$;

-- Add tab_display_name column to user_profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'user_profiles'
    AND column_name = 'tab_display_name'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN tab_display_name text;
  END IF;
END $$;

-- Add helpful comment
COMMENT ON COLUMN user_profiles.tab_display_name IS 'Custom name to display in profile tabs. If null, defaults to first name extracted from full_name.';
