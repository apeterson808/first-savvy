/*
  # Add Child Authentication System

  1. New Columns for child_profiles
    - `username` (text, unique, nullable) - Unique login username for child
    - `pin_hash` (text, nullable) - Bcrypt hashed PIN for authentication
    - `pin_last_changed` (timestamptz, nullable) - When PIN was last changed
    - `login_enabled` (boolean, default false) - Whether child can log in directly
    - `failed_login_attempts` (integer, default 0) - Track failed login attempts
    - `account_locked` (boolean, default false) - Lock account after too many failures
    - `last_login_at` (timestamptz, nullable) - Last successful login timestamp

  2. New Tables
    - `child_login_audit_log` - Track all child login attempts for security
      - `id` (uuid, primary key)
      - `child_profile_id` (uuid, foreign key)
      - `timestamp` (timestamptz)
      - `success` (boolean)
      - `ip_address` (text, nullable)
      - `user_agent` (text, nullable)
      - `failure_reason` (text, nullable)

  3. Security
    - Add unique constraint on username
    - Add index on username for fast lookups
    - Enable RLS on audit log table
    - Add policies for parents to view their children's login history
*/

-- Add authentication columns to child_profiles
ALTER TABLE child_profiles 
ADD COLUMN IF NOT EXISTS username text,
ADD COLUMN IF NOT EXISTS pin_hash text,
ADD COLUMN IF NOT EXISTS pin_last_changed timestamptz,
ADD COLUMN IF NOT EXISTS login_enabled boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS failed_login_attempts integer DEFAULT 0 NOT NULL,
ADD COLUMN IF NOT EXISTS account_locked boolean DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

-- Create unique index on username (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS child_profiles_username_unique_idx 
ON child_profiles (LOWER(username));

-- Create index for faster username lookups
CREATE INDEX IF NOT EXISTS child_profiles_username_idx 
ON child_profiles (username) WHERE username IS NOT NULL;

-- Create audit log table for child login attempts
CREATE TABLE IF NOT EXISTS child_login_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  timestamp timestamptz DEFAULT now() NOT NULL,
  success boolean NOT NULL,
  ip_address text,
  user_agent text,
  failure_reason text,
  created_at timestamptz DEFAULT now() NOT NULL
);

-- Add index on child_profile_id for faster queries
CREATE INDEX IF NOT EXISTS child_login_audit_log_child_profile_id_idx 
ON child_login_audit_log (child_profile_id, timestamp DESC);

-- Enable RLS on audit log table
ALTER TABLE child_login_audit_log ENABLE ROW LEVEL SECURITY;

-- Policy: Parents can view login history for their children
CREATE POLICY "Parents can view their children's login history"
ON child_login_audit_log
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM child_profiles cp
    JOIN profile_memberships pm ON pm.profile_id = cp.parent_profile_id
    WHERE cp.id = child_login_audit_log.child_profile_id
    AND pm.user_id = auth.uid()
    AND pm.role IN ('owner', 'co_owner')
  )
);

-- Policy: System can insert login audit records (via service role)
CREATE POLICY "System can insert login audit records"
ON child_login_audit_log
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Add comment to explain username uniqueness
COMMENT ON COLUMN child_profiles.username IS 'Unique username for child direct login (case-insensitive)';
COMMENT ON COLUMN child_profiles.pin_hash IS 'Bcrypt hashed PIN for child authentication';
COMMENT ON COLUMN child_profiles.login_enabled IS 'Whether child can log in directly with username and PIN';
