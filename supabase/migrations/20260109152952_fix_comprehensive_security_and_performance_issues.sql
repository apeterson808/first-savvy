/*
  # Comprehensive Security and Performance Fixes

  ## Security Fixes
  1. Add missing RLS policies for tables with RLS enabled
  2. Remove overly permissive anon policies
  3. Fix security definer view
  4. Optimize RLS policies to use `(select auth.uid())`

  ## Performance Fixes
  5. Add missing foreign key indexes
  6. Remove duplicate policies
  7. Remove unused indexes
  8. Fix function search paths
*/

-- =====================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_transaction_splits_category_account_id
  ON transaction_splits(category_account_id);

CREATE INDEX IF NOT EXISTS idx_transfer_registry_matched_transaction_id
  ON transfer_registry(matched_transaction_id);

-- =====================================================
-- 2. ADD MISSING RLS POLICIES
-- =====================================================

-- Policies for categorization_rules
CREATE POLICY "Users can view categorization rules for their profiles"
  ON categorization_rules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = categorization_rules.profile_id
      AND profiles.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert categorization rules for their profiles"
  ON categorization_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = categorization_rules.profile_id
      AND profiles.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update categorization rules for their profiles"
  ON categorization_rules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = categorization_rules.profile_id
      AND profiles.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete categorization rules for their profiles"
  ON categorization_rules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = categorization_rules.profile_id
      AND profiles.user_id = (select auth.uid())
    )
  );

-- Policies for contact_matching_rules
CREATE POLICY "Users can view contact matching rules for their profiles"
  ON contact_matching_rules
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = contact_matching_rules.profile_id
      AND profiles.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert contact matching rules for their profiles"
  ON contact_matching_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = contact_matching_rules.profile_id
      AND profiles.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update contact matching rules for their profiles"
  ON contact_matching_rules
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = contact_matching_rules.profile_id
      AND profiles.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete contact matching rules for their profiles"
  ON contact_matching_rules
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = contact_matching_rules.profile_id
      AND profiles.user_id = (select auth.uid())
    )
  );

-- Policies for transaction_splits
CREATE POLICY "Users can view transaction splits for their profiles"
  ON transaction_splits
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transactions t
      JOIN profiles p ON p.id = t.profile_id
      WHERE t.id = transaction_splits.transaction_id
      AND p.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert transaction splits for their profiles"
  ON transaction_splits
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM transactions t
      JOIN profiles p ON p.id = t.profile_id
      WHERE t.id = transaction_splits.transaction_id
      AND p.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update transaction splits for their profiles"
  ON transaction_splits
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transactions t
      JOIN profiles p ON p.id = t.profile_id
      WHERE t.id = transaction_splits.transaction_id
      AND p.user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete transaction splits for their profiles"
  ON transaction_splits
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transactions t
      JOIN profiles p ON p.id = t.profile_id
      WHERE t.id = transaction_splits.transaction_id
      AND p.user_id = (select auth.uid())
    )
  );

-- =====================================================
-- 3. OPTIMIZE RLS POLICIES
-- =====================================================

-- journal_entries policies
DROP POLICY IF EXISTS "Users can view journal entries for their profiles" ON journal_entries;
CREATE POLICY "Users can view journal entries for their profiles"
  ON journal_entries
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = journal_entries.profile_id
      AND profiles.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert journal entries for their profiles" ON journal_entries;
CREATE POLICY "Users can insert journal entries for their profiles"
  ON journal_entries
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = journal_entries.profile_id
      AND profiles.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update journal entries for their profiles" ON journal_entries;
CREATE POLICY "Users can update journal entries for their profiles"
  ON journal_entries
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = journal_entries.profile_id
      AND profiles.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete journal entries for their profiles" ON journal_entries;
CREATE POLICY "Users can delete journal entries for their profiles"
  ON journal_entries
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = journal_entries.profile_id
      AND profiles.user_id = (select auth.uid())
    )
  );

-- journal_entry_lines policies
DROP POLICY IF EXISTS "Users can view journal entry lines for their profiles" ON journal_entry_lines;
CREATE POLICY "Users can view journal entry lines for their profiles"
  ON journal_entry_lines
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      JOIN profiles p ON p.id = je.profile_id
      WHERE je.id = journal_entry_lines.journal_entry_id
      AND p.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert journal entry lines for their profiles" ON journal_entry_lines;
CREATE POLICY "Users can insert journal entry lines for their profiles"
  ON journal_entry_lines
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_entries je
      JOIN profiles p ON p.id = je.profile_id
      WHERE je.id = journal_entry_lines.journal_entry_id
      AND p.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update journal entry lines for their profiles" ON journal_entry_lines;
CREATE POLICY "Users can update journal entry lines for their profiles"
  ON journal_entry_lines
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      JOIN profiles p ON p.id = je.profile_id
      WHERE je.id = journal_entry_lines.journal_entry_id
      AND p.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete journal entry lines for their profiles" ON journal_entry_lines;
CREATE POLICY "Users can delete journal entry lines for their profiles"
  ON journal_entry_lines
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_entries je
      JOIN profiles p ON p.id = je.profile_id
      WHERE je.id = journal_entry_lines.journal_entry_id
      AND p.user_id = (select auth.uid())
    )
  );

-- profile_view_preferences policies
DROP POLICY IF EXISTS "Users can read own profile view preferences" ON profile_view_preferences;
CREATE POLICY "Users can read own profile view preferences"
  ON profile_view_preferences
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = profile_view_preferences.profile_id
      AND profiles.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert own profile view preferences" ON profile_view_preferences;
CREATE POLICY "Users can insert own profile view preferences"
  ON profile_view_preferences
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = profile_view_preferences.profile_id
      AND profiles.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own profile view preferences" ON profile_view_preferences;
CREATE POLICY "Users can update own profile view preferences"
  ON profile_view_preferences
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = profile_view_preferences.profile_id
      AND profiles.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own profile view preferences" ON profile_view_preferences;
CREATE POLICY "Users can delete own profile view preferences"
  ON profile_view_preferences
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = profile_view_preferences.profile_id
      AND profiles.user_id = (select auth.uid())
    )
  );

-- =====================================================
-- 4. REMOVE DUPLICATE POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Users can view transfer registry for accessible profiles" ON transfer_registry;

-- =====================================================
-- 5. REMOVE UNUSED INDEXES
-- =====================================================

DROP INDEX IF EXISTS idx_transactions_cleared_status;
DROP INDEX IF EXISTS idx_transactions_reconciliation;
DROP INDEX IF EXISTS idx_accounts_needs_reconciliation;
DROP INDEX IF EXISTS idx_profiles_user_id_fkey;
DROP INDEX IF EXISTS idx_profile_view_preferences_profile_id;
DROP INDEX IF EXISTS idx_profile_view_preferences_view_name;
DROP INDEX IF EXISTS idx_transactions_original_description;
DROP INDEX IF EXISTS idx_transactions_original_description_lower;
DROP INDEX IF EXISTS idx_transactions_contact_manually_set;
DROP INDEX IF EXISTS idx_journal_entries_user_id;
DROP INDEX IF EXISTS idx_journal_entry_lines_user_id;
DROP INDEX IF EXISTS idx_user_coa_needs_reconciliation;
DROP INDEX IF EXISTS idx_user_coa_last_sync;

-- =====================================================
-- 6. FIX FUNCTION SEARCH PATHS
-- =====================================================

ALTER FUNCTION update_statement_uploads_updated_at() SET search_path = '';
ALTER FUNCTION generate_journal_entry_number(uuid) SET search_path = '';
ALTER FUNCTION auto_activate_chart_account() SET search_path = '';
ALTER FUNCTION update_unreconciled_difference() SET search_path = '';
ALTER FUNCTION prevent_system_account_deletes() SET search_path = '';
ALTER FUNCTION update_journal_entry_updated_at() SET search_path = '';
ALTER FUNCTION update_balance_on_transaction_status_change() SET search_path = '';
ALTER FUNCTION validate_journal_entry_balance(jsonb) SET search_path = '';
ALTER FUNCTION prevent_system_account_updates() SET search_path = '';
ALTER FUNCTION recalculate_account_balance(uuid) SET search_path = '';
ALTER FUNCTION update_account_balance_from_journal() SET search_path = '';
ALTER FUNCTION update_profile_view_preferences_updated_at() SET search_path = '';

-- =====================================================
-- 7. REMOVE OVERLY PERMISSIVE ANON POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Anon can insert memberships during signup" ON profile_memberships;
DROP POLICY IF EXISTS "Anon can insert profiles during signup" ON profiles;
DROP POLICY IF EXISTS "Anon can insert chart accounts during signup" ON user_chart_of_accounts;
DROP POLICY IF EXISTS "Anon can insert user profiles during signup" ON user_settings;

-- =====================================================
-- 8. FIX SECURITY DEFINER VIEW
-- =====================================================

DROP VIEW IF EXISTS v_profile_tabs_display;

CREATE VIEW v_profile_tabs_display AS
SELECT
  pt.id,
  pt.profile_id,
  pt.owner_user_id,
  pt.profile_type,
  pt.display_name,
  pt.tab_order,
  pt.is_active,
  pt.profile_metadata,
  pt.state_data,
  pt.last_accessed_at,
  pt.created_at,
  pt.updated_at,
  p.user_id
FROM profile_tabs pt
JOIN profiles p ON p.id = pt.profile_id;

GRANT SELECT ON v_profile_tabs_display TO authenticated;
