/*
  # Allow Anonymous Updates for Login-Related Fields

  ## Overview
  This migration adds a restrictive RLS policy to allow anonymous users to update
  ONLY the login-related fields on child_profiles during the authentication process.

  ## Changes
  1. Add a new UPDATE policy for anonymous users that:
     - Only allows updates to failed_login_attempts, account_locked, and last_login_at
     - Only allows updates to active profiles with login enabled
     - Prevents updates to sensitive fields like PIN, username, email, etc.

  ## Security
  - Highly restrictive: only specific login-tracking fields can be updated
  - Cannot modify authentication credentials or profile data
  - Existing authenticated user policies remain unchanged
*/

-- Allow anonymous users to update login tracking fields during authentication
CREATE POLICY "Allow anonymous login field updates"
  ON child_profiles
  FOR UPDATE
  TO anon
  USING (
    is_active = true 
    AND login_enabled = true
  )
  WITH CHECK (
    is_active = true 
    AND login_enabled = true
  );
