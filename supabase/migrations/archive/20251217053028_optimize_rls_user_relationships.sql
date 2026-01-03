/*
  # Optimize RLS Policies - User Relationships

  1. Changes
    - Replace auth.uid() with (select auth.uid()) in all policies
    - This prevents re-evaluation for each row
  
  2. Performance Impact
    - Dramatically improves query performance at scale
    - Auth function is evaluated once per query instead of per row
*/

DROP POLICY IF EXISTS "Users can view relationships they are part of" ON user_relationships;
CREATE POLICY "Users can view relationships they are part of"
  ON user_relationships FOR SELECT
  TO authenticated
  USING (
    user_id = (select auth.uid()) OR 
    related_user_id = (select auth.uid())
  );

DROP POLICY IF EXISTS "Users can create relationships" ON user_relationships;
CREATE POLICY "Users can create relationships"
  ON user_relationships FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update their relationships" ON user_relationships;
CREATE POLICY "Users can update their relationships"
  ON user_relationships FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete their relationships" ON user_relationships;
CREATE POLICY "Users can delete their relationships"
  ON user_relationships FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));