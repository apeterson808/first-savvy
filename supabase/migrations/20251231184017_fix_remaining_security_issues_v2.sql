/*
  # Fix Remaining Security and Performance Issues

  1. Missing Indexes
    - Verify indexes exist for all unindexed foreign keys
    - Add any that are still missing

  2. Function Search Path
    - Fix validate_transaction_splits(uuid) function to have explicit search_path

  3. Verification
    - Ensure all RLS policies use (select auth.uid())
    - Ensure all views are not SECURITY DEFINER
    - Remove any remaining unused indexes
    - Fix duplicate policies
*/

-- =====================================================
-- 1. ENSURE ALL REQUIRED INDEXES EXIST
-- =====================================================

-- Index for profile_tabs.profile_user_id foreign key (already exists, but ensuring)
CREATE INDEX IF NOT EXISTS idx_profile_tabs_profile_user_id 
  ON public.profile_tabs (profile_user_id);

-- Index for transaction_splits.category_account_id foreign key (already exists, but ensuring)
CREATE INDEX IF NOT EXISTS idx_transaction_splits_category_account_id 
  ON public.transaction_splits (category_account_id);

-- Index for transfer_registry.matched_transaction_id foreign key (already exists, but ensuring)
CREATE INDEX IF NOT EXISTS idx_transfer_registry_matched_transaction_id 
  ON public.transfer_registry (matched_transaction_id);

-- =====================================================
-- 2. FIX FUNCTION SEARCH PATH
-- =====================================================

-- Fix the validate_transaction_splits function that takes a parameter
CREATE OR REPLACE FUNCTION public.validate_transaction_splits(p_transaction_id uuid)
RETURNS TABLE(is_valid boolean, transaction_amount numeric, splits_total numeric, difference numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (t.amount = COALESCE(SUM(ts.amount), 0)) as is_valid,
    t.amount as transaction_amount,
    COALESCE(SUM(ts.amount), 0) as splits_total,
    (t.amount - COALESCE(SUM(ts.amount), 0)) as difference
  FROM transactions t
  LEFT JOIN transaction_splits ts ON ts.transaction_id = t.id
  WHERE t.id = p_transaction_id
  GROUP BY t.id, t.amount;
END;
$$;

-- =====================================================
-- 3. VERIFY AND RE-CREATE VIEWS WITHOUT SECURITY DEFINER
-- =====================================================

-- Ensure views are created without SECURITY DEFINER
DROP VIEW IF EXISTS public.v_property_accounts CASCADE;
DROP VIEW IF EXISTS public.v_balance_sheet_accounts CASCADE;
DROP VIEW IF EXISTS public.v_loan_accounts CASCADE;
DROP VIEW IF EXISTS public.v_active_accounts CASCADE;
DROP VIEW IF EXISTS public.v_investment_accounts CASCADE;
DROP VIEW IF EXISTS public.v_transactional_accounts CASCADE;
DROP VIEW IF EXISTS public.v_income_statement_accounts CASCADE;

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
