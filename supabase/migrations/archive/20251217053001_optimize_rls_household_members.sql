/*
  # Optimize RLS Policies - Household Members

  1. Changes
    - Replace auth.uid() with (select auth.uid()) in all policies
    - Fix INSERT policy to properly check if user is admin before adding members
  
  2. Performance Impact
    - Dramatically improves query performance at scale
    - Auth function is evaluated once per query instead of per row
*/

DROP POLICY IF EXISTS "Household members can view members" ON household_members;
CREATE POLICY "Household members can view members"
  ON household_members FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_members.household_id
      AND hm.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can add household members" ON household_members;
CREATE POLICY "Admins can add household members"
  ON household_members FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_members.household_id
      AND hm.user_id = (select auth.uid())
      AND hm.role = 'Admin'
    )
  );

DROP POLICY IF EXISTS "Admins can update household members" ON household_members;
CREATE POLICY "Admins can update household members"
  ON household_members FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_members.household_id
      AND hm.user_id = (select auth.uid())
      AND hm.role = 'Admin'
    )
  );

DROP POLICY IF EXISTS "Admins and members can remove themselves" ON household_members;
CREATE POLICY "Admins and members can remove themselves"
  ON household_members FOR DELETE
  TO authenticated
  USING (
    user_id = (select auth.uid()) OR
    EXISTS (
      SELECT 1 FROM household_members hm
      WHERE hm.household_id = household_members.household_id
      AND hm.user_id = (select auth.uid())
      AND hm.role = 'Admin'
    )
  );