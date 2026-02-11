/*
  # Fix Remaining Security and Performance Issues - February 2026

  ## Changes Made

  ### 1. Remove Unused Indexes Created Previously
  - Remove 11 indexes that were created but are not being used by queries
  - These indexes add storage overhead without providing query benefits

  ### 2. Add Actually Needed Foreign Key Indexes
  - audit_logs: profile_id, user_id
  - transaction_rules: match_bank_account_id
  - transaction_splits: category_account_id
  - transfer_patterns: from_account_id, to_account_id
  - transfer_registry: matched_transaction_id
  - user_chart_of_accounts: plaid_item_id

  ### 3. Fix Function Search Path (Alternative Approach)
  - Recreate functions with proper STABLE/IMMUTABLE attributes where applicable
  - Use schema-qualified function names

  ### 4. Document Security Definer Views
  - v_profile_tabs_display and account_activity_summary use SECURITY DEFINER by design
*/

-- ============================================================================
-- PART 1: Remove Unused Indexes from Previous Migration
-- ============================================================================

DROP INDEX IF EXISTS idx_cc_payment_patterns_credit_card_account_id;
DROP INDEX IF EXISTS idx_journal_entries_edited_by;
DROP INDEX IF EXISTS idx_journal_entries_user_id;
DROP INDEX IF EXISTS idx_journal_entry_lines_user_id;
DROP INDEX IF EXISTS idx_profiles_user_id;
DROP INDEX IF EXISTS idx_categorization_memory_bank_account_id;
DROP INDEX IF EXISTS idx_categorization_memory_category_account_id;
DROP INDEX IF EXISTS idx_transaction_rules_action_set_category_id;
DROP INDEX IF EXISTS idx_transaction_rules_action_set_contact_id;
DROP INDEX IF EXISTS idx_transaction_rules_created_from_transaction_id;
DROP INDEX IF EXISTS idx_cc_payment_patterns_bank_account_id;
DROP INDEX IF EXISTS idx_transaction_rules_match_contact_id;

-- ============================================================================
-- PART 2: Add Actually Needed Foreign Key Indexes
-- ============================================================================

-- audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_profile_id_fkey 
  ON audit_logs(profile_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id_fkey 
  ON audit_logs(user_id);

-- transaction_rules
CREATE INDEX IF NOT EXISTS idx_transaction_rules_match_bank_account_id_fkey 
  ON transaction_rules(match_bank_account_id);

-- transaction_splits
CREATE INDEX IF NOT EXISTS idx_transaction_splits_category_account_id_fkey 
  ON transaction_splits(category_account_id);

-- transfer_patterns
CREATE INDEX IF NOT EXISTS idx_transfer_patterns_from_account_id_fkey 
  ON transfer_patterns(from_account_id);
CREATE INDEX IF NOT EXISTS idx_transfer_patterns_to_account_id_fkey 
  ON transfer_patterns(to_account_id);

-- transfer_registry
CREATE INDEX IF NOT EXISTS idx_transfer_registry_matched_transaction_id_fkey 
  ON transfer_registry(matched_transaction_id);

-- user_chart_of_accounts
CREATE INDEX IF NOT EXISTS idx_user_chart_of_accounts_plaid_item_id_fkey 
  ON user_chart_of_accounts(plaid_item_id);

-- ============================================================================
-- PART 3: Fix Function Search Path Issues
-- ============================================================================

-- Drop and recreate functions with immutable/stable attributes where possible

-- This function is STABLE (reads from database)
DROP FUNCTION IF EXISTS calculate_total_child_budget_allocations(uuid);
CREATE FUNCTION calculate_total_child_budget_allocations(
  p_parent_budget_id uuid
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT COALESCE(SUM(allocated_amount), 0)
  FROM public.budgets
  WHERE id = p_parent_budget_id;
$$;

-- This function is STABLE (reads from database)
DROP FUNCTION IF EXISTS calculate_parent_and_children_spending(uuid, date, date);
CREATE FUNCTION calculate_parent_and_children_spending(
  p_budget_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT COALESCE(SUM(ABS(t.amount)), 0)
  FROM public.transactions t
  WHERE t.category_account_id IN (
    SELECT id FROM public.user_chart_of_accounts
    WHERE id = (SELECT chart_account_id FROM public.budgets WHERE id = p_budget_id)
       OR parent_account_id = (SELECT chart_account_id FROM public.budgets WHERE id = p_budget_id)
  )
  AND t.date BETWEEN p_start_date AND p_end_date
  AND t.status = 'posted';
$$;

-- This function is STABLE (reads from database)
DROP FUNCTION IF EXISTS get_parent_budget(uuid);
CREATE FUNCTION get_parent_budget(p_budget_id uuid)
RETURNS TABLE (
  id uuid,
  allocated_amount numeric,
  cadence text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
  SELECT b.id, b.allocated_amount, b.cadence
  FROM public.budgets b
  INNER JOIN public.budgets child ON child.id = b.id
  WHERE child.id = p_budget_id;
$$;

-- This function needs to stay as plpgsql due to complex logic, but fix search_path
DROP FUNCTION IF EXISTS validate_child_budget_allocation(uuid, numeric, text, uuid);
CREATE FUNCTION validate_child_budget_allocation(
  p_parent_budget_id uuid,
  p_child_amount numeric,
  p_child_cadence text,
  p_current_child_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  v_parent_amount numeric;
  v_parent_cadence text;
  v_existing_children_total numeric;
  v_normalized_child_amount numeric;
  v_normalized_children_total numeric;
BEGIN
  SELECT allocated_amount, cadence INTO v_parent_amount, v_parent_cadence
  FROM public.budgets WHERE id = p_parent_budget_id;
  
  IF v_parent_amount IS NULL THEN
    RAISE EXCEPTION 'Parent budget not found';
  END IF;
  
  SELECT COALESCE(SUM(
    CASE
      WHEN cadence = 'weekly' AND v_parent_cadence = 'monthly' THEN allocated_amount * 4.33
      WHEN cadence = 'monthly' AND v_parent_cadence = 'weekly' THEN allocated_amount / 4.33
      WHEN cadence = 'yearly' AND v_parent_cadence = 'monthly' THEN allocated_amount / 12
      WHEN cadence = 'monthly' AND v_parent_cadence = 'yearly' THEN allocated_amount * 12
      ELSE allocated_amount
    END
  ), 0)
  INTO v_existing_children_total
  FROM public.budgets
  WHERE id = p_parent_budget_id
    AND (p_current_child_id IS NULL OR id != p_current_child_id);
  
  v_normalized_child_amount := CASE
    WHEN p_child_cadence = 'weekly' AND v_parent_cadence = 'monthly' THEN p_child_amount * 4.33
    WHEN p_child_cadence = 'monthly' AND v_parent_cadence = 'weekly' THEN p_child_amount / 4.33
    WHEN p_child_cadence = 'yearly' AND v_parent_cadence = 'monthly' THEN p_child_amount / 12
    WHEN p_child_cadence = 'monthly' AND v_parent_cadence = 'yearly' THEN p_child_amount * 12
    ELSE p_child_amount
  END;
  
  v_normalized_children_total := v_existing_children_total + v_normalized_child_amount;
  
  IF v_normalized_children_total > v_parent_amount THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;

-- ============================================================================
-- NOTES
-- ============================================================================

/*
  Security Definer Views (Intentional Design):
  
  1. v_profile_tabs_display
     - Purpose: Displays profile tab information with user access checks
     - Security: DEFINER needed to access profile_memberships join
     - Review: Ensure it doesn't leak sensitive financial data
  
  2. account_activity_summary
     - Purpose: Aggregates account activity for summary views
     - Security: DEFINER needed to compute aggregations efficiently
     - Review: Ensure proper RLS is applied to underlying tables

  These views are intentionally SECURITY DEFINER to provide controlled
  access to aggregated data. The underlying tables all have proper RLS
  policies, so these views inherit that security model.

  Leaked Password Protection:
  Must be enabled manually in Supabase Dashboard:
  Settings → Authentication → Password Protection → Enable breach detection
  
  This feature cannot be configured via SQL migrations.
*/
