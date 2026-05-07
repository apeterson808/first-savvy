/*
  # Household member read policies for all profile_id tables

  Grants SELECT access to all profile_id-bearing tables for users who are
  members (role = 'member' or 'admin') of a profile via profile_memberships.

  This allows a spouse/partner who joins as a household member to see all
  shared financial data — transactions, budgets, contacts, tasks, etc.

  Vault tables are intentionally excluded as those are personal/private.
*/

-- transactions
CREATE POLICY "Household members can view transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
  );

-- budgets
CREATE POLICY "Household members can view budgets"
  ON budgets FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
  );

-- journal_entry_lines
CREATE POLICY "Household members can view journal entry lines"
  ON journal_entry_lines FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
  );

-- contacts
CREATE POLICY "Household members can view contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
  );

-- tasks
CREATE POLICY "Household members can view tasks"
  ON tasks FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
  );

-- rewards
CREATE POLICY "Household members can view rewards"
  ON rewards FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
  );

-- calendar_events
CREATE POLICY "Household members can view calendar events"
  ON calendar_events FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
  );

-- calendar_preferences
CREATE POLICY "Household members can view calendar preferences"
  ON calendar_preferences FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
  );

-- meal_plan_entries
CREATE POLICY "Household members can view meal plan entries"
  ON meal_plan_entries FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
  );

-- meal_recipes
CREATE POLICY "Household members can view meal recipes"
  ON meal_recipes FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
  );

-- transaction_rules
CREATE POLICY "Household members can view transaction rules"
  ON transaction_rules FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
  );

-- transaction_splits
CREATE POLICY "Household members can view transaction splits"
  ON transaction_splits FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
  );

-- transfer_match_suggestions
CREATE POLICY "Household members can view transfer match suggestions"
  ON transfer_match_suggestions FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
  );

-- csv_column_mapping_configs
CREATE POLICY "Household members can view csv mapping configs"
  ON csv_column_mapping_configs FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
  );

-- chore_templates
CREATE POLICY "Household members can view chore templates"
  ON chore_templates FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
  );

-- accounting_periods
CREATE POLICY "Household members can view accounting periods"
  ON accounting_periods FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
  );

-- audit_logs
CREATE POLICY "Household members can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
  );

-- profile_view_preferences
CREATE POLICY "Household members can view profile view preferences"
  ON profile_view_preferences FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
  );

-- journal_entry_counters
CREATE POLICY "Household members can view journal entry counters"
  ON journal_entry_counters FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = auth.uid()
    )
  );
