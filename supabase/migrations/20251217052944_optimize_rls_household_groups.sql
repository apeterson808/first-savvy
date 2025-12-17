/*
  # Optimize RLS Policies - Household Groups

  1. Changes
    - Replace auth.uid() with (select auth.uid()) in all policies
    - This prevents re-evaluation for each row
  
  2. Performance Impact
    - Dramatically improves query performance at scale
    - Auth function is evaluated once per query instead of per row
*/

DROP POLICY IF EXISTS "Household members can view their household" ON household_groups;
CREATE POLICY "Household members can view their household"
  ON household_groups FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM household_members
      WHERE household_members.household_id = household_groups.id
      AND household_members.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create household groups" ON household_groups;
CREATE POLICY "Users can create household groups"
  ON household_groups FOR INSERT
  TO authenticated
  WITH CHECK (created_by_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Admins can update household groups" ON household_groups;
CREATE POLICY "Admins can update household groups"
  ON household_groups FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM household_members
      WHERE household_members.household_id = household_groups.id
      AND household_members.user_id = (select auth.uid())
      AND household_members.role = 'Admin'
    )
  );

DROP POLICY IF EXISTS "Creators can delete household groups" ON household_groups;
CREATE POLICY "Creators can delete household groups"
  ON household_groups FOR DELETE
  TO authenticated
  USING (created_by_user_id = (select auth.uid()));