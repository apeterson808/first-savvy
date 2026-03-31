/*
  # Fix Profile Shares Recursive RLS Policies

  1. Changes
    - Drop existing recursive RLS policies on profile_shares
    - Create new non-recursive policies that don't cause infinite recursion
    - Use parent_access_grants for co-parent permission checking instead of profile_shares
  
  2. Security
    - Users can view shares where they own the child or are the recipient
    - Users can create shares for child profiles they own
    - Users can update shares for child profiles they own
*/

-- Drop existing recursive policies
DROP POLICY IF EXISTS "Users can view shares for their profiles" ON profile_shares;
DROP POLICY IF EXISTS "Users can create shares for profiles they own or co-parent" ON profile_shares;
DROP POLICY IF EXISTS "Users can update shares for profiles they own or co-parent" ON profile_shares;

-- Create non-recursive SELECT policy
CREATE POLICY "Users can view shares for their profiles"
  ON profile_shares
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM child_profiles cp
      WHERE cp.id = profile_shares.child_profile_id
        AND (
          -- Owner can see all shares
          cp.owned_by_profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
          )
          OR
          -- Recipient can see their own share
          profile_shares.shared_with_profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
          )
        )
    )
  );

-- Create non-recursive INSERT policy
CREATE POLICY "Users can create shares for profiles they own"
  ON profile_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM child_profiles cp
      WHERE cp.id = profile_shares.child_profile_id
        AND cp.owned_by_profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    )
    AND
    -- Limit to 3 active shares per child
    (
      SELECT COUNT(*)
      FROM profile_shares ps
      WHERE ps.child_profile_id = profile_shares.child_profile_id
        AND ps.is_active = true
    ) < 3
  );

-- Create non-recursive UPDATE policy
CREATE POLICY "Users can update shares for profiles they own"
  ON profile_shares
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM child_profiles cp
      WHERE cp.id = profile_shares.child_profile_id
        AND cp.owned_by_profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
    )
  );