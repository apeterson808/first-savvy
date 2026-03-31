/*
  # Fix Chart of Accounts RLS for Virtual Child Profiles

  ## Overview
  Virtual child profiles (profiles with user_id = NULL) need to be accessible when:
  1. The authenticated user owns the child profile (via child_profiles.owned_by_profile_id)
  2. The authenticated user has access through profile_shares

  ## Changes
  - Update user_chart_of_accounts RLS policies to include virtual profile access
  - Allow access when the profile is owned_by a profile belonging to the authenticated user
  - Allow access when the profile is shared with the authenticated user

  ## Security
  - Virtual profiles remain secure - only accessible by parents/shared users
  - No public access to virtual profiles
  - Maintains existing access patterns for regular profiles
*/

-- Drop existing RLS policies for user_chart_of_accounts
DROP POLICY IF EXISTS "Users can view own chart of accounts" ON user_chart_of_accounts;
DROP POLICY IF EXISTS "Users can insert own chart of accounts" ON user_chart_of_accounts;
DROP POLICY IF EXISTS "Users can update own chart of accounts" ON user_chart_of_accounts;
DROP POLICY IF EXISTS "Users can delete own chart of accounts" ON user_chart_of_accounts;

-- CREATE SELECT policy
CREATE POLICY "Users can view chart of accounts"
  ON user_chart_of_accounts FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
      UNION
      SELECT owned_by_profile_id
      FROM child_profiles
      WHERE parent_profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
      AND owned_by_profile_id IS NOT NULL
      UNION
      SELECT cp.owned_by_profile_id
      FROM profile_shares ps
      INNER JOIN child_profiles cp ON cp.id = ps.child_profile_id
      WHERE ps.shared_with_profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
      AND ps.is_active = true
      AND cp.owned_by_profile_id IS NOT NULL
    )
  );

-- CREATE INSERT policy
CREATE POLICY "Users can insert chart of accounts"
  ON user_chart_of_accounts FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
      UNION
      SELECT owned_by_profile_id
      FROM child_profiles
      WHERE parent_profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
      AND owned_by_profile_id IS NOT NULL
      UNION
      SELECT cp.owned_by_profile_id
      FROM profile_shares ps
      INNER JOIN child_profiles cp ON cp.id = ps.child_profile_id
      WHERE ps.shared_with_profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
      AND ps.is_active = true
      AND cp.owned_by_profile_id IS NOT NULL
    )
  );

-- CREATE UPDATE policy
CREATE POLICY "Users can update chart of accounts"
  ON user_chart_of_accounts FOR UPDATE
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
      UNION
      SELECT owned_by_profile_id
      FROM child_profiles
      WHERE parent_profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
      AND owned_by_profile_id IS NOT NULL
      UNION
      SELECT cp.owned_by_profile_id
      FROM profile_shares ps
      INNER JOIN child_profiles cp ON cp.id = ps.child_profile_id
      WHERE ps.shared_with_profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
      AND ps.is_active = true
      AND cp.owned_by_profile_id IS NOT NULL
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
      UNION
      SELECT owned_by_profile_id
      FROM child_profiles
      WHERE parent_profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
      AND owned_by_profile_id IS NOT NULL
      UNION
      SELECT cp.owned_by_profile_id
      FROM profile_shares ps
      INNER JOIN child_profiles cp ON cp.id = ps.child_profile_id
      WHERE ps.shared_with_profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
      AND ps.is_active = true
      AND cp.owned_by_profile_id IS NOT NULL
    )
  );

-- CREATE DELETE policy
CREATE POLICY "Users can delete chart of accounts"
  ON user_chart_of_accounts FOR DELETE
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
      UNION
      SELECT owned_by_profile_id
      FROM child_profiles
      WHERE parent_profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
      AND owned_by_profile_id IS NOT NULL
      UNION
      SELECT cp.owned_by_profile_id
      FROM profile_shares ps
      INNER JOIN child_profiles cp ON cp.id = ps.child_profile_id
      WHERE ps.shared_with_profile_id IN (
        SELECT id FROM profiles WHERE user_id = auth.uid()
      )
      AND ps.is_active = true
      AND cp.owned_by_profile_id IS NOT NULL
    )
  );