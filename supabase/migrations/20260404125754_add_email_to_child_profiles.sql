/*
  # Add email field to child profiles

  1. Changes
    - Add `email` column to `child_profiles` table
    - Email is optional and unique
    - Used for child authentication and communication

  2. Security
    - No RLS changes needed (inherits from existing policies)
*/

ALTER TABLE child_profiles 
ADD COLUMN IF NOT EXISTS email text UNIQUE;

CREATE INDEX IF NOT EXISTS idx_child_profiles_email ON child_profiles(email) WHERE email IS NOT NULL;

COMMENT ON COLUMN child_profiles.email IS 'Email address for child login and notifications';
