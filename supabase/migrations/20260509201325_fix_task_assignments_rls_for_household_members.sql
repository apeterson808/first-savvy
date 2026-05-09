/*
  # Fix task_assignments RLS for household members

  ## Problem
  The existing "Parents can view task assignments they own" policy checks
  `profiles.user_id = auth.uid()` which only matches the profile owner.
  Household members (spouse/partner with role='member') are blocked because
  they don't own the profile — they're only in profile_memberships.

  ## Fix
  Add a SELECT policy that allows household members to view task_assignments
  for tasks belonging to any profile they're a member of.
*/

CREATE POLICY "Household members can view task assignments"
  ON task_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM tasks t
      JOIN profile_memberships pm ON pm.profile_id = t.profile_id
      WHERE t.id = task_assignments.task_id
        AND pm.user_id = auth.uid()
    )
  );
