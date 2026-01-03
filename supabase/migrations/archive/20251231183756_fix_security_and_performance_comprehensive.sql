/*
  # Fix Comprehensive Security and Performance Issues

  1. Missing Indexes
    - Add indexes for unindexed foreign keys:
      - profile_tabs.profile_user_id
      - transaction_splits.category_account_id
      - transfer_registry.matched_transaction_id

  2. RLS Performance Optimization
    - Fix all policies to use `(select auth.uid())` instead of `auth.uid()`
    - This prevents re-evaluation for each row and improves query performance

  3. Remove Unused Indexes
    - Drop 24 unused indexes to reduce maintenance overhead

  4. Fix Multiple Permissive Policies
    - Remove duplicate policies on financial_institutions and profiles

  5. Fix Security Definer Views
    - Recreate views without SECURITY DEFINER or with proper restrictions

  6. Fix Function Search Paths
    - Set explicit search_path on all trigger functions

  7. Enable Password Protection (Note: This must be done via Supabase Dashboard)
*/

-- =====================================================
-- 1. ADD MISSING INDEXES FOR FOREIGN KEYS
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_profile_tabs_profile_user_id 
  ON public.profile_tabs (profile_user_id);

CREATE INDEX IF NOT EXISTS idx_transaction_splits_category_account_id 
  ON public.transaction_splits (category_account_id);

CREATE INDEX IF NOT EXISTS idx_transfer_registry_matched_transaction_id 
  ON public.transfer_registry (matched_transaction_id);

-- =====================================================
-- 2. OPTIMIZE RLS POLICIES - USE (SELECT auth.uid())
-- =====================================================

-- user_chart_of_accounts
DROP POLICY IF EXISTS "Users can insert chart of accounts in their profiles" ON public.user_chart_of_accounts;
CREATE POLICY "Users can insert chart of accounts in their profiles"
  ON public.user_chart_of_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- profile_tabs policies
DROP POLICY IF EXISTS "Users can create own profile tabs" ON public.profile_tabs;
CREATE POLICY "Users can create own profile tabs"
  ON public.profile_tabs
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own profile tabs" ON public.profile_tabs;
CREATE POLICY "Users can delete own profile tabs"
  ON public.profile_tabs
  FOR DELETE
  TO authenticated
  USING (owner_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own profile tabs" ON public.profile_tabs;
CREATE POLICY "Users can update own profile tabs"
  ON public.profile_tabs
  FOR UPDATE
  TO authenticated
  USING (owner_user_id = (select auth.uid()))
  WITH CHECK (owner_user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own profile tabs" ON public.profile_tabs;
CREATE POLICY "Users can view own profile tabs"
  ON public.profile_tabs
  FOR SELECT
  TO authenticated
  USING (owner_user_id = (select auth.uid()));

-- profiles policies
DROP POLICY IF EXISTS "Profile owners can soft-delete their profiles" ON public.profiles;
CREATE POLICY "Profile owners can soft-delete their profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()) AND is_deleted = false)
  WITH CHECK (user_id = (select auth.uid()) AND is_deleted = true);

DROP POLICY IF EXISTS "Profile owners can update their profiles" ON public.profiles;
CREATE POLICY "Profile owners can update their profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "System can create profiles during signup" ON public.profiles;
CREATE POLICY "System can create profiles during signup"
  ON public.profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- profile_memberships policies
DROP POLICY IF EXISTS "Profile owners can delete memberships" ON public.profile_memberships;
CREATE POLICY "Profile owners can delete memberships"
  ON public.profile_memberships
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = profile_memberships.profile_id
      AND profiles.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Profile owners can insert memberships" ON public.profile_memberships;
CREATE POLICY "Profile owners can insert memberships"
  ON public.profile_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = profile_memberships.profile_id
      AND profiles.user_id = (select auth.uid())
    )
  );

DROP POLICY IF EXISTS "Profile owners can update memberships" ON public.profile_memberships;
CREATE POLICY "Profile owners can update memberships"
  ON public.profile_memberships
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = profile_memberships.profile_id
      AND profiles.user_id = (select auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = profile_memberships.profile_id
      AND profiles.user_id = (select auth.uid())
    )
  );

-- transfer_registry policies
DROP POLICY IF EXISTS "Users can delete own transfer registry entries" ON public.transfer_registry;
CREATE POLICY "Users can delete own transfer registry entries"
  ON public.transfer_registry
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can insert own transfer registry entries" ON public.transfer_registry;
CREATE POLICY "Users can insert own transfer registry entries"
  ON public.transfer_registry
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own transfer registry entries" ON public.transfer_registry;
CREATE POLICY "Users can update own transfer registry entries"
  ON public.transfer_registry
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own transfer registry entries" ON public.transfer_registry;
CREATE POLICY "Users can view own transfer registry entries"
  ON public.transfer_registry
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- categorization_rules policies
DROP POLICY IF EXISTS "Users can create categorization rules in their profiles" ON public.categorization_rules;
CREATE POLICY "Users can create categorization rules in their profiles"
  ON public.categorization_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own categorization rules" ON public.categorization_rules;
CREATE POLICY "Users can delete own categorization rules"
  ON public.categorization_rules
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own categorization rules" ON public.categorization_rules;
CREATE POLICY "Users can update own categorization rules"
  ON public.categorization_rules
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own categorization rules" ON public.categorization_rules;
CREATE POLICY "Users can view own categorization rules"
  ON public.categorization_rules
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- contact_matching_rules policies
DROP POLICY IF EXISTS "Users can create contact matching rules in their profiles" ON public.contact_matching_rules;
CREATE POLICY "Users can create contact matching rules in their profiles"
  ON public.contact_matching_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete own contact matching rules" ON public.contact_matching_rules;
CREATE POLICY "Users can delete own contact matching rules"
  ON public.contact_matching_rules
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update own contact matching rules" ON public.contact_matching_rules;
CREATE POLICY "Users can update own contact matching rules"
  ON public.contact_matching_rules
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view own contact matching rules" ON public.contact_matching_rules;
CREATE POLICY "Users can view own contact matching rules"
  ON public.contact_matching_rules
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- transaction_splits policies
DROP POLICY IF EXISTS "Users can create splits for their own transactions" ON public.transaction_splits;
CREATE POLICY "Users can create splits for their own transactions"
  ON public.transaction_splits
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can delete splits for their own transactions" ON public.transaction_splits;
CREATE POLICY "Users can delete splits for their own transactions"
  ON public.transaction_splits
  FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can update splits for their own transactions" ON public.transaction_splits;
CREATE POLICY "Users can update splits for their own transactions"
  ON public.transaction_splits
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

DROP POLICY IF EXISTS "Users can view splits for their own transactions" ON public.transaction_splits;
CREATE POLICY "Users can view splits for their own transactions"
  ON public.transaction_splits
  FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

-- =====================================================
-- 3. REMOVE UNUSED INDEXES
-- =====================================================

DROP INDEX IF EXISTS public.idx_financial_institutions_name;
DROP INDEX IF EXISTS public.idx_user_coa_type_active_networth;
DROP INDEX IF EXISTS public.idx_profile_tabs_owner_user_id;
DROP INDEX IF EXISTS public.idx_profile_tabs_tab_order;
DROP INDEX IF EXISTS public.idx_profile_tabs_is_active;
DROP INDEX IF EXISTS public.idx_user_coa_plaid_item;
DROP INDEX IF EXISTS public.idx_user_coa_closed;
DROP INDEX IF EXISTS public.idx_plaid_items_sync_required;
DROP INDEX IF EXISTS public.idx_categorization_rules_user_id;
DROP INDEX IF EXISTS public.idx_categorization_rules_profile_active;
DROP INDEX IF EXISTS public.idx_contact_matching_rules_user_id;
DROP INDEX IF EXISTS public.idx_contact_matching_rules_profile_active;
DROP INDEX IF EXISTS public.idx_contact_matching_rules_contact_id;
DROP INDEX IF EXISTS public.idx_transaction_splits_transaction_id;
DROP INDEX IF EXISTS public.idx_transaction_splits_user_id;
DROP INDEX IF EXISTS public.idx_transaction_splits_profile_id;
DROP INDEX IF EXISTS public.idx_user_coa_user_profile;
DROP INDEX IF EXISTS public.idx_profile_memberships_user_profile;
DROP INDEX IF EXISTS public.idx_profiles_user_id;
DROP INDEX IF EXISTS public.idx_transfer_registry_user_id;
DROP INDEX IF EXISTS public.idx_transfer_registry_is_matched;
DROP INDEX IF EXISTS public.idx_transactions_original_type;
DROP INDEX IF EXISTS public.idx_transactions_include_in_reports;
DROP INDEX IF EXISTS public.idx_transactions_posted_date;

-- =====================================================
-- 4. FIX MULTIPLE PERMISSIVE POLICIES
-- =====================================================

-- Remove duplicate policy on financial_institutions
DROP POLICY IF EXISTS "Authenticated users can view all institutions" ON public.financial_institutions;

-- Merge the two UPDATE policies on profiles into one comprehensive policy
DROP POLICY IF EXISTS "Profile owners can soft-delete their profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profile owners can update their profiles" ON public.profiles;

CREATE POLICY "Profile owners can update their profiles"
  ON public.profiles
  FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

-- =====================================================
-- 5. FIX SECURITY DEFINER VIEWS
-- =====================================================

-- Drop and recreate views without SECURITY DEFINER
DROP VIEW IF EXISTS public.v_property_accounts CASCADE;
DROP VIEW IF EXISTS public.v_balance_sheet_accounts CASCADE;
DROP VIEW IF EXISTS public.v_loan_accounts CASCADE;
DROP VIEW IF EXISTS public.v_active_accounts CASCADE;
DROP VIEW IF EXISTS public.v_investment_accounts CASCADE;
DROP VIEW IF EXISTS public.v_transactional_accounts CASCADE;
DROP VIEW IF EXISTS public.v_income_statement_accounts CASCADE;

-- Recreate views without SECURITY DEFINER
CREATE VIEW public.v_transactional_accounts AS
SELECT * FROM user_chart_of_accounts
WHERE account_detail IN ('checking_account', 'savings_account', 'credit_card')
AND is_active = true;

CREATE VIEW public.v_balance_sheet_accounts AS
SELECT * FROM user_chart_of_accounts
WHERE class IN ('asset', 'liability', 'equity')
AND is_active = true;

CREATE VIEW public.v_income_statement_accounts AS
SELECT * FROM user_chart_of_accounts
WHERE class IN ('income', 'expense')
AND is_active = true;

CREATE VIEW public.v_active_accounts AS
SELECT * FROM user_chart_of_accounts
WHERE is_active = true;

CREATE VIEW public.v_investment_accounts AS
SELECT * FROM user_chart_of_accounts
WHERE account_type = 'investments'
AND is_active = true;

CREATE VIEW public.v_property_accounts AS
SELECT * FROM user_chart_of_accounts
WHERE account_type = 'real_estate'
AND is_active = true;

CREATE VIEW public.v_loan_accounts AS
SELECT * FROM user_chart_of_accounts
WHERE account_type IN ('loans', 'mortgages')
AND is_active = true;

-- =====================================================
-- 6. FIX FUNCTION SEARCH PATHS
-- =====================================================

-- Fix update_categorization_rules_updated_at
CREATE OR REPLACE FUNCTION public.update_categorization_rules_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix update_transaction_splits_updated_at
CREATE OR REPLACE FUNCTION public.update_transaction_splits_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix update_user_chart_of_accounts_updated_at
CREATE OR REPLACE FUNCTION public.update_user_chart_of_accounts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix validate_transaction_splits
CREATE OR REPLACE FUNCTION public.validate_transaction_splits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  transaction_amount NUMERIC;
  splits_total NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    SELECT amount INTO transaction_amount
    FROM transactions
    WHERE id = NEW.transaction_id;

    SELECT COALESCE(SUM(amount), 0) INTO splits_total
    FROM transaction_splits
    WHERE transaction_id = NEW.transaction_id
    AND (TG_OP = 'UPDATE' AND id != NEW.id OR TG_OP = 'INSERT');

    IF splits_total + NEW.amount > transaction_amount THEN
      RAISE EXCEPTION 'Split amounts exceed transaction amount';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Fix update_contact_matching_rules_updated_at
CREATE OR REPLACE FUNCTION public.update_contact_matching_rules_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix update_profile_tabs_updated_at
CREATE OR REPLACE FUNCTION public.update_profile_tabs_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix ensure_single_active_tab
CREATE OR REPLACE FUNCTION public.ensure_single_active_tab()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_active = true THEN
    UPDATE profile_tabs
    SET is_active = false
    WHERE owner_user_id = NEW.owner_user_id
    AND id != NEW.id
    AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$;
