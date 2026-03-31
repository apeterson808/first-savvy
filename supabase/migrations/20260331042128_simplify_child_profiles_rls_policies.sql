/*
  # Simplify Child Profiles RLS Policies

  1. Changes
    - Remove duplicate and conflicting policies on child_profiles
    - Keep only the simple, non-recursive policies
    - Remove references to profile_shares to avoid circular dependency
  
  2. Security
    - Parents can manage child profiles through their profile ownership
    - Children with user accounts can view/update their own profiles
*/

-- Drop all existing policies on child_profiles
DROP POLICY IF EXISTS "Parents can view their children" ON child_profiles;
DROP POLICY IF EXISTS "Users can view own child profiles" ON child_profiles;
DROP POLICY IF EXISTS "Parents can create children" ON child_profiles;
DROP POLICY IF EXISTS "Users can insert own child profiles" ON child_profiles;
DROP POLICY IF EXISTS "Parents can update their children" ON child_profiles;
DROP POLICY IF EXISTS "Users can update own child profiles" ON child_profiles;
DROP POLICY IF EXISTS "Parents can delete their children" ON child_profiles;
DROP POLICY IF EXISTS "Users can delete own child profiles" ON child_profiles;

-- Create simple SELECT policy
CREATE POLICY "Users can view their child profiles"
  ON child_profiles
  FOR SELECT
  TO authenticated
  USING (
    -- Parent owns the profile
    parent_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    OR
    -- Child has their own user account
    user_id = auth.uid()
  );

-- Create simple INSERT policy
CREATE POLICY "Users can create child profiles"
  ON child_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    parent_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Create simple UPDATE policy
CREATE POLICY "Users can update their child profiles"
  ON child_profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- Parent owns the profile
    parent_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    OR
    -- Child with permission level 4+ can update their own
    (user_id = auth.uid() AND current_permission_level >= 4)
  );

-- Create simple DELETE policy
CREATE POLICY "Users can delete their child profiles"
  ON child_profiles
  FOR DELETE
  TO authenticated
  USING (
    parent_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );