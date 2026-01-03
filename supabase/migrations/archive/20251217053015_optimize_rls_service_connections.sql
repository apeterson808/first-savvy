/*
  # Optimize RLS Policies - Service Connections

  1. Changes
    - Replace auth.uid() with (select auth.uid()) in all policies
    - This prevents re-evaluation for each row
  
  2. Performance Impact
    - Dramatically improves query performance at scale
    - Auth function is evaluated once per query instead of per row
*/

DROP POLICY IF EXISTS "Users can view own service connections" ON service_connections;
CREATE POLICY "Users can view own service connections"
  ON service_connections FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own service connections" ON service_connections;
CREATE POLICY "Users can insert own service connections"
  ON service_connections FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own service connections" ON service_connections;
CREATE POLICY "Users can update own service connections"
  ON service_connections FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own service connections" ON service_connections;
CREATE POLICY "Users can delete own service connections"
  ON service_connections FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));