/*
  # Optimize RLS Policies - Shared Resources

  1. Changes
    - Replace auth.uid() with (select auth.uid()) in all policies
    - This prevents re-evaluation for each row
  
  2. Performance Impact
    - Dramatically improves query performance at scale
    - Auth function is evaluated once per query instead of per row
*/

DROP POLICY IF EXISTS "Owners and shared users can view shared resources" ON shared_resources;
CREATE POLICY "Owners and shared users can view shared resources"
  ON shared_resources FOR SELECT
  TO authenticated
  USING (
    owner_user_id = (select auth.uid()) OR 
    shared_with_user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Owners can create shared resources" ON shared_resources;
CREATE POLICY "Owners can create shared resources"
  ON shared_resources FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Owners can update shared resources" ON shared_resources;
CREATE POLICY "Owners can update shared resources"
  ON shared_resources FOR UPDATE
  TO authenticated
  USING (owner_user_id = (select auth.uid()))
  WITH CHECK (owner_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Owners can delete shared resources" ON shared_resources;
CREATE POLICY "Owners can delete shared resources"
  ON shared_resources FOR DELETE
  TO authenticated
  USING (owner_user_id = (select auth.uid()));