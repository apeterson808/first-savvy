/*
  # Fix Journal Entry Write RLS for Household Members

  ## Problem
  The INSERT, UPDATE, and DELETE policies on journal_entries and journal_entry_lines
  currently check `profiles.user_id = auth.uid()` — this means only the profile
  owner (Andrew) can write journal entries. Household members (Jenna) are blocked
  from all writes even though they have read access.

  ## Changes
  1. Drop the owner-only INSERT/UPDATE/DELETE policies on journal_entries
  2. Replace them with policies using has_profile_access() — consistent with how
     transactions and budgets already work
  3. Same fix applied to journal_entry_lines

  ## Security
  has_profile_access() checks profile_memberships, so only users who are actual
  members of the household (owner OR member OR viewer) can write. Viewers should
  ideally be read-only — that can be tightened in a future migration when the
  viewer role is fully enforced. For now this unblocks household members.
*/

-- journal_entries: replace owner-only write policies with has_profile_access()

DROP POLICY IF EXISTS "Users can insert journal entries for their profiles" ON journal_entries;
DROP POLICY IF EXISTS "Users can update journal entries for their profiles" ON journal_entries;
DROP POLICY IF EXISTS "Users can delete journal entries for their profiles" ON journal_entries;

CREATE POLICY "Household members can insert journal entries"
  ON journal_entries FOR INSERT
  TO authenticated
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Household members can update journal entries"
  ON journal_entries FOR UPDATE
  TO authenticated
  USING (has_profile_access(profile_id))
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Household members can delete journal entries"
  ON journal_entries FOR DELETE
  TO authenticated
  USING (has_profile_access(profile_id));

-- journal_entry_lines: replace owner-only write policies with has_profile_access()

DROP POLICY IF EXISTS "Users can insert journal entry lines for their profiles" ON journal_entry_lines;
DROP POLICY IF EXISTS "Users can update journal entry lines for their profiles" ON journal_entry_lines;
DROP POLICY IF EXISTS "Users can delete journal entry lines for their profiles" ON journal_entry_lines;

CREATE POLICY "Household members can insert journal entry lines"
  ON journal_entry_lines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_id
      AND has_profile_access(je.profile_id)
    )
  );

CREATE POLICY "Household members can update journal entry lines"
  ON journal_entry_lines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_id
      AND has_profile_access(je.profile_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_id
      AND has_profile_access(je.profile_id)
    )
  );

CREATE POLICY "Household members can delete journal entry lines"
  ON journal_entry_lines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      WHERE je.id = journal_entry_id
      AND has_profile_access(je.profile_id)
    )
  );
