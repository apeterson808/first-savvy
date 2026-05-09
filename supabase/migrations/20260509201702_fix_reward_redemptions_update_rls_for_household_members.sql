/*
  # Fix reward_redemptions UPDATE RLS for household members

  The existing UPDATE policy restricts parent access to role IN ('owner','admin').
  Household members with role='member' (e.g. spouse) cannot approve reward redemptions.
*/

CREATE POLICY "Household members can update child reward redemptions"
  ON reward_redemptions FOR UPDATE
  TO authenticated
  USING (
    child_profile_id IN (
      SELECT cp.id
      FROM child_profiles cp
      JOIN profile_memberships pm ON pm.profile_id = cp.parent_profile_id
      WHERE pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    child_profile_id IN (
      SELECT cp.id
      FROM child_profiles cp
      JOIN profile_memberships pm ON pm.profile_id = cp.parent_profile_id
      WHERE pm.user_id = auth.uid()
    )
  );
