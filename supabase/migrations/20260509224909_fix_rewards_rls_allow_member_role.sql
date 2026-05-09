/*
  # Fix Rewards RLS — Allow member Role to Update/Delete

  ## Problem
  The "Parents can update rewards" policy checks:
    role = ANY(ARRAY['owner', 'admin'])
  This blocks household members with role = 'member' from editing or creating rewards,
  even though they should have full household access.

  ## Changes
  1. Drop the restrictive UPDATE policy on rewards
  2. Replace it with one that allows 'owner', 'member', and 'admin' roles
  3. Add a DELETE policy for household members (none existed previously)
  4. Add an INSERT policy for household members (the existing INSERT policy
     "Parents can manage rewards" may already be permissive — we replace it
     to be explicit)

  ## Security
  All policies still require the user to be an authenticated member of the
  profile via profile_memberships.
*/

-- Fix UPDATE policy: allow owner AND member roles
DROP POLICY IF EXISTS "Parents can update rewards" ON rewards;

CREATE POLICY "Household members can update rewards"
  ON rewards FOR UPDATE
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'member', 'admin')
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT profile_id FROM profile_memberships
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'member', 'admin')
    )
  );

-- Add DELETE policy for household members
DROP POLICY IF EXISTS "Household members can delete rewards" ON rewards;

CREATE POLICY "Household members can delete rewards"
  ON rewards FOR DELETE
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'member', 'admin')
    )
  );

-- Replace INSERT policy to be explicit about member role
DROP POLICY IF EXISTS "Parents can manage rewards" ON rewards;

CREATE POLICY "Household members can insert rewards"
  ON rewards FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT profile_id FROM profile_memberships
      WHERE user_id = auth.uid()
      AND role IN ('owner', 'member', 'admin')
    )
  );
