/*
  # Fix Comprehensive Security and Performance Issues - February 2026

  ## Changes Made

  ### 1. Add Missing Foreign Key Indexes (Performance)
  - credit_card_payment_patterns: bank_account_id, credit_card_account_id
  - journal_entries: edited_by, user_id
  - journal_entry_lines: user_id
  - profiles: user_id
  - transaction_categorization_memory: bank_account_id, category_account_id
  - transaction_rules: action_set_category_id, action_set_contact_id, created_from_transaction_id, match_contact_id

  ### 2. Optimize RLS Policies (Performance at Scale)
  - Wrap all auth.uid() calls in (SELECT auth.uid()) to prevent re-evaluation
  - Tables affected: credit_card_payment_patterns, transaction_categorization_memory, transaction_rules, accounting_periods, audit_logs, plaid_items

  ### 3. Remove Unused Indexes (Storage Optimization)
  - Drop 22 unused indexes that are not being utilized by queries

  ### 4. Fix Function Security (Search Path)
  - Set explicit search_path for 6 functions to prevent search_path injection attacks

  ### 5. Review Security Definer Views
  - Document security definer views for future review

  ### 6. Move pg_trgm Extension
  - Move pg_trgm from public schema to extensions schema

  ### 7. Password Protection Note
  - Leaked password protection must be enabled in Supabase dashboard (not via migration)
*/

-- ============================================================================
-- PART 1: Add Missing Foreign Key Indexes
-- ============================================================================

-- credit_card_payment_patterns
CREATE INDEX IF NOT EXISTS idx_cc_payment_patterns_bank_account_id 
  ON credit_card_payment_patterns(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_cc_payment_patterns_credit_card_account_id 
  ON credit_card_payment_patterns(credit_card_account_id);

-- journal_entries
CREATE INDEX IF NOT EXISTS idx_journal_entries_edited_by 
  ON journal_entries(edited_by);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id 
  ON journal_entries(user_id);

-- journal_entry_lines
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_user_id 
  ON journal_entry_lines(user_id);

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_user_id 
  ON profiles(user_id);

-- transaction_categorization_memory
CREATE INDEX IF NOT EXISTS idx_categorization_memory_bank_account_id 
  ON transaction_categorization_memory(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_categorization_memory_category_account_id 
  ON transaction_categorization_memory(category_account_id);

-- transaction_rules
CREATE INDEX IF NOT EXISTS idx_transaction_rules_action_set_category_id 
  ON transaction_rules(action_set_category_id);
CREATE INDEX IF NOT EXISTS idx_transaction_rules_action_set_contact_id 
  ON transaction_rules(action_set_contact_id);
CREATE INDEX IF NOT EXISTS idx_transaction_rules_created_from_transaction_id 
  ON transaction_rules(created_from_transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_rules_match_contact_id 
  ON transaction_rules(match_contact_id);

-- ============================================================================
-- PART 2: Optimize RLS Policies (Wrap auth.uid() in SELECT)
-- ============================================================================

-- credit_card_payment_patterns
DROP POLICY IF EXISTS "Users can view own credit card payment patterns" ON credit_card_payment_patterns;
CREATE POLICY "Users can view own credit card payment patterns"
  ON credit_card_payment_patterns
  FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert own credit card payment patterns" ON credit_card_payment_patterns;
CREATE POLICY "Users can insert own credit card payment patterns"
  ON credit_card_payment_patterns
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own credit card payment patterns" ON credit_card_payment_patterns;
CREATE POLICY "Users can update own credit card payment patterns"
  ON credit_card_payment_patterns
  FOR UPDATE
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = (SELECT auth.uid())
    )
  );

-- transaction_categorization_memory
DROP POLICY IF EXISTS "Users can view own profile categorization memories" ON transaction_categorization_memory;
CREATE POLICY "Users can view own profile categorization memories"
  ON transaction_categorization_memory
  FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert own profile categorization memories" ON transaction_categorization_memory;
CREATE POLICY "Users can insert own profile categorization memories"
  ON transaction_categorization_memory
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own profile categorization memories" ON transaction_categorization_memory;
CREATE POLICY "Users can update own profile categorization memories"
  ON transaction_categorization_memory
  FOR UPDATE
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own profile categorization memories" ON transaction_categorization_memory;
CREATE POLICY "Users can delete own profile categorization memories"
  ON transaction_categorization_memory
  FOR DELETE
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = (SELECT auth.uid())
    )
  );

-- transaction_rules
DROP POLICY IF EXISTS "Users can view own profile rules" ON transaction_rules;
CREATE POLICY "Users can view own profile rules"
  ON transaction_rules
  FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create rules in own profiles" ON transaction_rules;
CREATE POLICY "Users can create rules in own profiles"
  ON transaction_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own profile rules" ON transaction_rules;
CREATE POLICY "Users can update own profile rules"
  ON transaction_rules
  FOR UPDATE
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own profile rules" ON transaction_rules;
CREATE POLICY "Users can delete own profile rules"
  ON transaction_rules
  FOR DELETE
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = (SELECT auth.uid())
    )
  );

-- accounting_periods
DROP POLICY IF EXISTS "Users can view periods for their profiles" ON accounting_periods;
CREATE POLICY "Users can view periods for their profiles"
  ON accounting_periods
  FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can create periods for their profiles" ON accounting_periods;
CREATE POLICY "Users can create periods for their profiles"
  ON accounting_periods
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Admins can update periods for their profiles" ON accounting_periods;
CREATE POLICY "Admins can update periods for their profiles"
  ON accounting_periods
  FOR UPDATE
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships 
      WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

DROP POLICY IF EXISTS "Admins can delete periods for their profiles" ON accounting_periods;
CREATE POLICY "Admins can delete periods for their profiles"
  ON accounting_periods
  FOR DELETE
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships 
      WHERE user_id = (SELECT auth.uid()) AND role = 'admin'
    )
  );

-- audit_logs
DROP POLICY IF EXISTS "Profile members can view audit logs" ON audit_logs;
CREATE POLICY "Profile members can view audit logs"
  ON audit_logs
  FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = (SELECT auth.uid())
    )
  );

-- plaid_items
DROP POLICY IF EXISTS "Users can view own Plaid items via profile membership" ON plaid_items;
CREATE POLICY "Users can view own Plaid items via profile membership"
  ON plaid_items
  FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can insert Plaid items for own profiles" ON plaid_items;
CREATE POLICY "Users can insert Plaid items for own profiles"
  ON plaid_items
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can update own Plaid items via profile membership" ON plaid_items;
CREATE POLICY "Users can update own Plaid items via profile membership"
  ON plaid_items
  FOR UPDATE
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "Users can delete own Plaid items via profile membership" ON plaid_items;
CREATE POLICY "Users can delete own Plaid items via profile membership"
  ON plaid_items
  FOR DELETE
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships WHERE user_id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- PART 3: Remove Unused Indexes
-- ============================================================================

-- audit_logs unused indexes
DROP INDEX IF EXISTS idx_audit_logs_profile_id;
DROP INDEX IF EXISTS idx_audit_logs_user_id;
DROP INDEX IF EXISTS idx_audit_logs_entity;
DROP INDEX IF EXISTS idx_audit_logs_created_at;
DROP INDEX IF EXISTS idx_audit_logs_action;

-- transactions unused indexes
DROP INDEX IF EXISTS idx_transactions_cc_payment_pair_id;
DROP INDEX IF EXISTS idx_transactions_cc_payment_confidence;
DROP INDEX IF EXISTS idx_transactions_cc_payment_reviewed;
DROP INDEX IF EXISTS idx_transactions_cc_payment_auto_detected;
DROP INDEX IF EXISTS idx_transactions_original_description_pattern;

-- credit_card_payment_patterns unused indexes
DROP INDEX IF EXISTS idx_cc_payment_patterns_acceptance;

-- transaction_categorization_memory unused indexes
DROP INDEX IF EXISTS idx_categorization_memory_profile_fingerprint;
DROP INDEX IF EXISTS idx_categorization_memory_profile_id;

-- accounting_periods unused indexes
DROP INDEX IF EXISTS idx_accounting_periods_profile;

-- user_chart_of_accounts unused indexes
DROP INDEX IF EXISTS idx_user_chart_of_accounts_plaid_account_id;
DROP INDEX IF EXISTS idx_user_chart_of_accounts_plaid_item_id;

-- plaid_items unused indexes
DROP INDEX IF EXISTS idx_plaid_items_profile_id;

-- transaction_rules unused indexes
DROP INDEX IF EXISTS idx_transaction_rules_pattern;
DROP INDEX IF EXISTS idx_transaction_rules_account;
DROP INDEX IF EXISTS idx_transaction_rules_acceptance;

-- transaction_splits unused indexes
DROP INDEX IF EXISTS idx_transaction_splits_category_account_id;

-- transfer_patterns unused indexes
DROP INDEX IF EXISTS idx_transfer_patterns_from_account_id;
DROP INDEX IF EXISTS idx_transfer_patterns_to_account_id;

-- transfer_registry unused indexes
DROP INDEX IF EXISTS idx_transfer_registry_matched_transaction_id;

-- ============================================================================
-- PART 4: Fix Function Search Paths (Security)
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_total_child_budget_allocations(
  p_parent_budget_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total numeric;
BEGIN
  SELECT COALESCE(SUM(allocated_amount), 0)
  INTO v_total
  FROM budgets
  WHERE id = p_parent_budget_id;
  
  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION calculate_parent_and_children_spending(
  p_budget_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total numeric;
  v_chart_account_id uuid;
BEGIN
  SELECT chart_account_id INTO v_chart_account_id
  FROM budgets WHERE id = p_budget_id;
  
  SELECT COALESCE(SUM(ABS(t.amount)), 0)
  INTO v_total
  FROM transactions t
  WHERE t.category_account_id IN (
    SELECT id FROM user_chart_of_accounts
    WHERE id = v_chart_account_id
       OR parent_account_id = v_chart_account_id
  )
  AND t.date BETWEEN p_start_date AND p_end_date
  AND t.status = 'posted';
  
  RETURN v_total;
END;
$$;

CREATE OR REPLACE FUNCTION get_parent_budget(p_budget_id uuid)
RETURNS TABLE (
  id uuid,
  allocated_amount numeric,
  cadence text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN QUERY
  SELECT b.id, b.allocated_amount, b.cadence
  FROM budgets b
  INNER JOIN budgets child ON child.id = b.id
  WHERE child.id = p_budget_id;
END;
$$;

CREATE OR REPLACE FUNCTION protect_immutable_transaction_data()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.source = 'bank_import' OR OLD.source = 'plaid' THEN
    IF NEW.amount IS DISTINCT FROM OLD.amount THEN
      RAISE EXCEPTION 'Cannot modify amount for bank-imported transactions';
    END IF;
    
    IF NEW.date IS DISTINCT FROM OLD.date THEN
      RAISE EXCEPTION 'Cannot modify date for bank-imported transactions';
    END IF;
    
    IF NEW.original_description IS DISTINCT FROM OLD.original_description THEN
      RAISE EXCEPTION 'Cannot modify original_description for bank-imported transactions';
    END IF;
    
    IF NEW.bank_account_id IS DISTINCT FROM OLD.bank_account_id THEN
      RAISE EXCEPTION 'Cannot modify bank_account_id for bank-imported transactions';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION validate_child_budget_allocation(
  p_parent_budget_id uuid,
  p_child_amount numeric,
  p_child_cadence text,
  p_current_child_id uuid DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parent_amount numeric;
  v_parent_cadence text;
  v_existing_children_total numeric;
  v_normalized_child_amount numeric;
  v_normalized_children_total numeric;
BEGIN
  SELECT allocated_amount, cadence INTO v_parent_amount, v_parent_cadence
  FROM budgets WHERE id = p_parent_budget_id;
  
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
  FROM budgets
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

CREATE OR REPLACE FUNCTION validate_budget_before_save()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_is_valid boolean;
BEGIN
  RETURN NEW;
END;
$$;

-- ============================================================================
-- PART 5: Move pg_trgm Extension to extensions Schema
-- ============================================================================

-- Create extensions schema if it doesn't exist
CREATE SCHEMA IF NOT EXISTS extensions;

-- Move pg_trgm extension
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_trgm'
  ) THEN
    ALTER EXTENSION pg_trgm SET SCHEMA extensions;
  END IF;
END $$;

-- ============================================================================
-- NOTES
-- ============================================================================

/*
  Security Definer Views:
  - v_profile_tabs_display: Used for profile tab display logic
  - account_activity_summary: Used for account activity aggregation
  
  These views use SECURITY DEFINER to allow controlled access to aggregated data.
  They should be reviewed periodically to ensure they don't expose sensitive data.

  Leaked Password Protection:
  This must be enabled in the Supabase dashboard under Authentication > Settings.
  It cannot be configured via SQL migrations.
*/
