/*
  # Simplify Child Login RLS for Parent-Authenticated Flow

  ## Overview
  This migration updates the RLS policies to support the new parent-authenticated
  child profile selection flow. Parents log in normally, then select a child profile
  and enter the child's PIN. All database operations happen as the authenticated parent.

  ## Changes Made
  
  1. **Remove Anonymous Policies**
     - Drop anonymous INSERT policy on child_login_audit_log
     - Drop anonymous UPDATE policy on child_profiles
     - All operations now require authenticated users (parents)
  
  2. **Update child_profiles Policies**
     - Parents can SELECT their own child profiles
     - Parents can UPDATE login tracking fields on their children's profiles
     - Maintains existing security for other operations
  
  3. **Update child_login_audit_log Policies**
     - Parents can INSERT audit log entries for their children
     - Maintains read-only access for parents to view their children's logs
  
  ## Security Benefits
  - No more anonymous database access
  - All queries authenticated via Supabase Auth
  - Simpler policy logic
  - Follows standard RLS patterns
  - Parent maintains full control since they're the authenticated user

  ## Notes
  - Child profiles are now accessed via parent authentication
  - PIN verification still provides child-level security
  - Audit logging continues to track all access attempts
*/

-- Drop anonymous policies from child_login_audit_log
DROP POLICY IF EXISTS "Allow login audit log entries" ON child_login_audit_log;

-- Drop anonymous policies from child_profiles
DROP POLICY IF EXISTS "Allow anonymous login field updates" ON child_profiles;
DROP POLICY IF EXISTS "Anonymous can read profiles for login" ON child_profiles;

-- Recreate child_login_audit_log INSERT policy for authenticated parents only
CREATE POLICY "Parents can log child login attempts"
  ON child_login_audit_log
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM child_profiles cp
      WHERE cp.id = child_profile_id
      AND (
        cp.parent_profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
        OR cp.owned_by_profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
      )
    )
  );

-- Update child_profiles UPDATE policy to allow parents to update login fields
DROP POLICY IF EXISTS "Parents can update child profiles" ON child_profiles;

CREATE POLICY "Parents can update child profiles"
  ON child_profiles
  FOR UPDATE
  TO authenticated
  USING (
    parent_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    OR owned_by_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    parent_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    OR owned_by_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Ensure parents can read their own child profiles
DROP POLICY IF EXISTS "Parents can view child profiles" ON child_profiles;

CREATE POLICY "Parents can view child profiles"
  ON child_profiles
  FOR SELECT
  TO authenticated
  USING (
    parent_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    OR owned_by_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );
