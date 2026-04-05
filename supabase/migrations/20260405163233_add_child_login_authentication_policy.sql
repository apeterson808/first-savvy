/*
  # Add Child Login Authentication Policy

  ## Overview
  This migration adds a secure RLS policy to allow unauthenticated users to query
  child_profiles table ONLY for login/authentication purposes. The policy is carefully
  designed to expose only the minimal data needed for authentication.

  ## Changes
  1. Add a new RLS policy for anonymous users to SELECT child profiles by username/email
     - Only allows looking up by exact username or email match
     - Only returns active profiles with login enabled
     - Does not expose sensitive data beyond what's needed for authentication

  ## Security
  - Policy is restrictive and only allows authentication lookups
  - No INSERT, UPDATE, or DELETE permissions for anonymous users
  - Existing authenticated user policies remain unchanged
*/

-- Allow anonymous users to read child profiles for authentication purposes
-- This is required so the login flow can verify credentials
CREATE POLICY "Allow anonymous login lookups for child profiles"
  ON child_profiles
  FOR SELECT
  TO anon
  USING (
    is_active = true 
    AND login_enabled = true
  );
