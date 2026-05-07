/*
  # Add household member access policies

  Allows users who are members (not just owners) of a profile to:
  - View child_profiles that belong to that profile
  - View user_chart_of_accounts for profiles they are members of
  - View journal_entries for profiles they are members of

  This supports the household-connection feature where a spouse/partner
  joins as a 'member' and needs to see all shared data.
*/

-- child_profiles: members of the parent profile can view
CREATE POLICY "Household members can view child profiles"
  ON child_profiles FOR SELECT
  TO authenticated
  USING (
    parent_profile_id IN (
      SELECT profile_id FROM profile_memberships
      WHERE user_id = auth.uid()
    )
  );

-- user_chart_of_accounts: members can view
CREATE POLICY "Household members can view chart of accounts"
  ON user_chart_of_accounts FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships
      WHERE user_id = auth.uid()
    )
  );

-- journal_entries: members can view
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'journal_entries') THEN
    EXECUTE $policy$
      CREATE POLICY "Household members can view journal entries"
        ON journal_entries FOR SELECT
        TO authenticated
        USING (
          profile_id IN (
            SELECT profile_id FROM profile_memberships
            WHERE user_id = auth.uid()
          )
        )
    $policy$;
  END IF;
END $$;
