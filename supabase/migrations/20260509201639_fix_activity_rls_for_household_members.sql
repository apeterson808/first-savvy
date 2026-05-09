/*
  # Fix activity RLS for household members

  ## Problem
  Two tables block household members (role='member') from viewing child activity:

  1. task_completions SELECT policy joins profiles.user_id = auth.uid() — only works
     for the profile owner, not spouse/partner members.

  2. reward_redemptions SELECT policy checks profile_memberships.role IN ('owner','admin')
     — Jenna has role='member' so she's excluded.

  ## Fix
  Add SELECT policies for both tables that use profile_memberships without role restriction,
  matching the same pattern already used for tasks and child_profiles.
*/

-- task_completions: allow household members to view completions for their shared children
CREATE POLICY "Household members can view child task completions"
  ON task_completions FOR SELECT
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
  );

-- reward_redemptions: allow household members to view redemptions for their shared children
CREATE POLICY "Household members can view child reward redemptions"
  ON reward_redemptions FOR SELECT
  TO authenticated
  USING (
    child_profile_id IN (
      SELECT cp.id
      FROM child_profiles cp
      JOIN profile_memberships pm ON pm.profile_id = cp.parent_profile_id
      WHERE pm.user_id = auth.uid()
    )
  );
