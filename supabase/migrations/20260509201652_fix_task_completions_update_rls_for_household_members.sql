/*
  # Fix task_completions UPDATE RLS for household members

  The existing UPDATE policy uses profiles.user_id = auth.uid() which only allows
  the profile owner to approve/reject task completions. Household members (role='member')
  need the same ability.
*/

CREATE POLICY "Household members can review child task completions"
  ON task_completions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM child_profiles cp
      JOIN profile_memberships pm ON pm.profile_id = cp.parent_profile_id
      WHERE cp.id = task_completions.child_profile_id
        AND pm.user_id = auth.uid()
        AND cp.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM child_profiles cp
      JOIN profile_memberships pm ON pm.profile_id = cp.parent_profile_id
      WHERE cp.id = task_completions.child_profile_id
        AND pm.user_id = auth.uid()
        AND cp.is_active = true
    )
  );
