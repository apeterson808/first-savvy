/*
  # Optimize RLS Policies - Invitations

  1. Changes
    - Replace auth.uid() with (select auth.uid()) in all policies
    - This prevents re-evaluation for each row
  
  2. Performance Impact
    - Dramatically improves query performance at scale
    - Auth function is evaluated once per query instead of per row
*/

DROP POLICY IF EXISTS "Inviters can view their sent invitations" ON invitations;
CREATE POLICY "Inviters can view their sent invitations"
  ON invitations FOR SELECT
  TO authenticated
  USING (inviter_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can create invitations" ON invitations;
CREATE POLICY "Users can create invitations"
  ON invitations FOR INSERT
  TO authenticated
  WITH CHECK (inviter_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Inviters can update their invitations" ON invitations;
CREATE POLICY "Inviters can update their invitations"
  ON invitations FOR UPDATE
  TO authenticated
  USING (inviter_user_id = (select auth.uid()))
  WITH CHECK (inviter_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Inviters can delete their invitations" ON invitations;
CREATE POLICY "Inviters can delete their invitations"
  ON invitations FOR DELETE
  TO authenticated
  USING (inviter_user_id = (select auth.uid()));