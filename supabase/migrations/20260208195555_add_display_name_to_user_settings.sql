/*
  # Add Display Name Field to User Settings

  1. Changes
    - Add `display_name` column to user_settings table
    - Automatically populate display_name from full_name for existing users
    - Users can customize this field independently from first/last name

  2. Notes
    - Display name is what appears throughout the app (welcome message, avatars, etc.)
    - Falls back to full_name if display_name is not set
    - Allows users to set nicknames or preferred names
*/

-- Add display_name column
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS display_name TEXT;

-- Populate display_name from full_name for existing users
UPDATE user_settings
SET display_name = full_name
WHERE display_name IS NULL AND full_name IS NOT NULL AND full_name != '';