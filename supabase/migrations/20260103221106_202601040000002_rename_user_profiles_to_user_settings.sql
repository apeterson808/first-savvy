/*
  # Rename user_profiles to user_settings

  ## Overview
  Renames the user_profiles table to user_settings to better reflect its purpose:
  storing user account preferences, NOT financial data ownership.

  ## Changes
  1. Rename table user_profiles → user_settings
  2. Update comments to clarify purpose
  3. All foreign key constraints are automatically updated by PostgreSQL
*/

-- Rename the table
ALTER TABLE user_profiles RENAME TO user_settings;

-- Update table comment
COMMENT ON TABLE user_settings IS 'User account preferences and settings. NOT financial data ownership. All financial data is owned by profiles.';
COMMENT ON COLUMN user_settings.profile_type IS 'User account type (personal/business), determines available features. Not related to financial profiles.';
COMMENT ON COLUMN user_settings.tab_display_name IS 'Custom name to display in profile tabs. If null, defaults to first name extracted from full_name.';
