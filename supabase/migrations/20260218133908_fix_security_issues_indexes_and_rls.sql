/*
  # Fix Security Issues - Indexes and RLS Optimization

  1. Indexes
    - Add missing indexes for foreign keys on ai_category_suggestions and ai_contact_suggestions
    - Remove unused indexes that are not being utilized

  2. RLS Policy Optimization
    - Update RLS policies to use (select auth.uid()) instead of auth.uid() for better performance
    - Applies to csv_column_mapping_configs and ai_contact_suggestions tables

  3. Security Improvements
    - Fix security definer views
    - Fix function search paths to prevent injection attacks
*/

-- ============================================================================
-- 1. ADD MISSING INDEXES FOR FOREIGN KEYS
-- ============================================================================

-- Index for ai_category_suggestions.suggested_category_account_id
CREATE INDEX IF NOT EXISTS idx_ai_category_suggestions_suggested_category_account_id 
ON ai_category_suggestions(suggested_category_account_id);

-- Index for ai_contact_suggestions.suggested_contact_id
CREATE INDEX IF NOT EXISTS idx_ai_contact_suggestions_suggested_contact_id 
ON ai_contact_suggestions(suggested_contact_id);

-- ============================================================================
-- 2. REMOVE UNUSED INDEXES
-- ============================================================================

DROP INDEX IF EXISTS idx_csv_column_mapping_configs_profile_id;
DROP INDEX IF EXISTS idx_audit_logs_profile_id_fkey;
DROP INDEX IF EXISTS idx_audit_logs_user_id_fkey;
DROP INDEX IF EXISTS idx_transaction_rules_match_bank_account_id_fkey;
DROP INDEX IF EXISTS idx_transaction_splits_category_account_id_fkey;
DROP INDEX IF EXISTS idx_transfer_patterns_from_account_id_fkey;
DROP INDEX IF EXISTS idx_transfer_patterns_to_account_id_fkey;
DROP INDEX IF EXISTS idx_transfer_registry_matched_transaction_id_fkey;
DROP INDEX IF EXISTS idx_cc_payment_patterns_bank_account_id_fk;
DROP INDEX IF EXISTS idx_cc_payment_patterns_credit_card_account_id_fk;
DROP INDEX IF EXISTS idx_journal_entries_edited_by_fk;
DROP INDEX IF EXISTS idx_journal_entries_user_id_fk;
DROP INDEX IF EXISTS idx_journal_entry_lines_user_id_fk;
DROP INDEX IF EXISTS idx_profiles_user_id_fk;
DROP INDEX IF EXISTS idx_transaction_categorization_memory_bank_account_id_fk;
DROP INDEX IF EXISTS idx_transaction_categorization_memory_category_account_id_fk;
DROP INDEX IF EXISTS idx_transaction_rules_action_set_category_id_fk;
DROP INDEX IF EXISTS idx_transaction_rules_action_set_contact_id_fk;
DROP INDEX IF EXISTS idx_transaction_rules_created_from_transaction_id_fk;
DROP INDEX IF EXISTS idx_transaction_rules_match_contact_id_fk;
DROP INDEX IF EXISTS idx_ai_contact_suggestions_profile_id;

-- ============================================================================
-- 3. OPTIMIZE RLS POLICIES - csv_column_mapping_configs
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own CSV mapping configs" ON csv_column_mapping_configs;
DROP POLICY IF EXISTS "Users can insert own CSV mapping configs" ON csv_column_mapping_configs;
DROP POLICY IF EXISTS "Users can update own CSV mapping configs" ON csv_column_mapping_configs;
DROP POLICY IF EXISTS "Users can delete own CSV mapping configs" ON csv_column_mapping_configs;

CREATE POLICY "Users can view own CSV mapping configs"
  ON csv_column_mapping_configs FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can insert own CSV mapping configs"
  ON csv_column_mapping_configs FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can update own CSV mapping configs"
  ON csv_column_mapping_configs FOR UPDATE
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "Users can delete own CSV mapping configs"
  ON csv_column_mapping_configs FOR DELETE
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = (select auth.uid())
    )
  );

-- ============================================================================
-- 4. OPTIMIZE RLS POLICIES - ai_contact_suggestions
-- ============================================================================

DROP POLICY IF EXISTS "Users can read own AI contact suggestions" ON ai_contact_suggestions;
DROP POLICY IF EXISTS "Users can insert own AI contact suggestions" ON ai_contact_suggestions;
DROP POLICY IF EXISTS "Users can update own AI contact suggestions" ON ai_contact_suggestions;
DROP POLICY IF EXISTS "Users can delete own AI contact suggestions" ON ai_contact_suggestions;

CREATE POLICY "Users can read own AI contact suggestions"
  ON ai_contact_suggestions FOR SELECT
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = (select auth.uid())
  ));

CREATE POLICY "Users can insert own AI contact suggestions"
  ON ai_contact_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = (select auth.uid())
  ));

CREATE POLICY "Users can update own AI contact suggestions"
  ON ai_contact_suggestions FOR UPDATE
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = (select auth.uid())
  ))
  WITH CHECK (profile_id IN (
    SELECT id FROM profiles WHERE user_id = (select auth.uid())
  ));

CREATE POLICY "Users can delete own AI contact suggestions"
  ON ai_contact_suggestions FOR DELETE
  TO authenticated
  USING (profile_id IN (
    SELECT id FROM profiles WHERE user_id = (select auth.uid())
  ));

-- ============================================================================
-- 5. FIX SECURITY DEFINER VIEWS
-- ============================================================================

-- Recreate v_profile_tabs_display without SECURITY DEFINER
DROP VIEW IF EXISTS v_profile_tabs_display CASCADE;
CREATE VIEW v_profile_tabs_display AS
SELECT 
  pt.id,
  pt.owner_user_id,
  pt.profile_id,
  pt.display_name AS tab_display_name,
  p.display_name AS profile_display_name,
  p.profile_type,
  pt.tab_order,
  pt.is_active,
  pt.last_accessed_at,
  pt.created_at
FROM profile_tabs pt
LEFT JOIN profiles p ON p.id = pt.profile_id
WHERE pt.owner_user_id = (select auth.uid())
ORDER BY pt.tab_order;

-- Recreate account_activity_summary without SECURITY DEFINER
DROP VIEW IF EXISTS account_activity_summary CASCADE;
CREATE VIEW account_activity_summary AS
SELECT 
  a.id AS account_id,
  a.display_name,
  a.class,
  a.current_balance,
  COUNT(DISTINCT jel.id) AS transaction_count,
  MAX(je.entry_date) AS last_transaction_date,
  a.profile_id
FROM user_chart_of_accounts a
LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE a.is_active = true
GROUP BY a.id, a.display_name, a.class, a.current_balance, a.profile_id;

-- ============================================================================
-- 6. FIX FUNCTION SEARCH PATHS
-- ============================================================================

-- Fix calculate_total_child_budget_allocations
DROP FUNCTION IF EXISTS calculate_total_child_budget_allocations(uuid);
CREATE FUNCTION calculate_total_child_budget_allocations(parent_account_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  total_allocated numeric := 0;
BEGIN
  SELECT COALESCE(SUM(allocated_amount), 0)
  INTO total_allocated
  FROM user_chart_of_accounts
  WHERE parent_account_id = calculate_total_child_budget_allocations.parent_account_id
    AND is_active = true;
  
  RETURN total_allocated;
END;
$$;

-- Fix calculate_parent_and_children_spending
DROP FUNCTION IF EXISTS calculate_parent_and_children_spending(uuid, date, date);
CREATE FUNCTION calculate_parent_and_children_spending(
  p_account_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(parent_spending numeric, children_spending numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  WITH parent_txns AS (
    SELECT COALESCE(SUM(ABS(t.amount)), 0) as parent_total
    FROM transactions t
    WHERE t.category_account_id = p_account_id
      AND t.date >= p_start_date
      AND t.date <= p_end_date
      AND t.status = 'posted'
      AND t.include_in_reports = true
  ),
  children_txns AS (
    SELECT COALESCE(SUM(ABS(t.amount)), 0) as children_total
    FROM transactions t
    JOIN user_chart_of_accounts uca ON t.category_account_id = uca.id
    WHERE uca.parent_account_id = p_account_id
      AND t.date >= p_start_date
      AND t.date <= p_end_date
      AND t.status = 'posted'
      AND t.include_in_reports = true
  )
  SELECT 
    parent_txns.parent_total as parent_spending,
    children_txns.children_total as children_spending
  FROM parent_txns, children_txns;
END;
$$;

-- Fix get_parent_budget
DROP FUNCTION IF EXISTS get_parent_budget(uuid);
CREATE FUNCTION get_parent_budget(child_account_id uuid)
RETURNS TABLE(parent_id uuid, parent_allocated_amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uca.id as parent_id,
    uca.allocated_amount as parent_allocated_amount
  FROM user_chart_of_accounts child
  JOIN user_chart_of_accounts uca ON child.parent_account_id = uca.id
  WHERE child.id = child_account_id
    AND uca.is_active = true;
END;
$$;

-- Fix validate_child_budget_allocation
DROP FUNCTION IF EXISTS validate_child_budget_allocation();
CREATE FUNCTION validate_child_budget_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  parent_allocated numeric;
  siblings_total numeric;
  new_total numeric;
BEGIN
  IF NEW.parent_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT allocated_amount INTO parent_allocated
  FROM user_chart_of_accounts
  WHERE id = NEW.parent_account_id;

  IF parent_allocated IS NULL OR parent_allocated = 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(allocated_amount), 0) INTO siblings_total
  FROM user_chart_of_accounts
  WHERE parent_account_id = NEW.parent_account_id
    AND id != NEW.id
    AND is_active = true;

  new_total := siblings_total + COALESCE(NEW.allocated_amount, 0);

  IF new_total > parent_allocated THEN
    RAISE EXCEPTION 'Child budget allocations (%) exceed parent budget (%)', new_total, parent_allocated;
  END IF;

  RETURN NEW;
END;
$$;

-- Fix reset_financial_data_for_profile
DROP FUNCTION IF EXISTS reset_financial_data_for_profile(uuid);
CREATE FUNCTION reset_financial_data_for_profile(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM transaction_splits WHERE profile_id = p_profile_id;
  DELETE FROM transactions WHERE profile_id = p_profile_id;
  DELETE FROM journal_entry_lines WHERE profile_id = p_profile_id;
  DELETE FROM journal_entries WHERE profile_id = p_profile_id;
  DELETE FROM transfer_registry WHERE profile_id = p_profile_id;
  DELETE FROM transfer_patterns WHERE profile_id = p_profile_id;
  DELETE FROM credit_card_payment_registry WHERE profile_id = p_profile_id;
  DELETE FROM credit_card_payment_patterns WHERE profile_id = p_profile_id;
  DELETE FROM transaction_rules WHERE profile_id = p_profile_id;
  DELETE FROM transaction_categorization_memory WHERE profile_id = p_profile_id;
  DELETE FROM contacts WHERE profile_id = p_profile_id;
  
  UPDATE user_chart_of_accounts 
  SET 
    current_balance = 0,
    bank_balance = NULL,
    statement_balance = NULL,
    last_statement_date = NULL,
    last_synced_at = NULL,
    institution_name = NULL,
    account_number_last4 = NULL
  WHERE profile_id = p_profile_id
    AND template_account_number NOT IN ('3000.000', '9999.000');
  
  DELETE FROM user_chart_of_accounts 
  WHERE profile_id = p_profile_id 
    AND is_user_created = true;
END;
$$;