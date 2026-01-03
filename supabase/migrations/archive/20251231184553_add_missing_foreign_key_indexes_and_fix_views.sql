/*
  # Add Missing Foreign Key Indexes and Fix View Security

  1. Missing Foreign Key Indexes
    - Add index on categorization_rules(user_id)
    - Add index on contact_matching_rules(contact_id)
    - Add index on contact_matching_rules(user_id)
    - Add index on profiles(user_id)
    - Add index on transaction_splits(transaction_id)
    - Add index on transaction_splits(user_id)
    - Add index on transfer_registry(user_id)

  2. Remove Unused Indexes
    - Drop idx_profile_tabs_profile_user_id (unused)
    - Drop idx_transaction_splits_category_account_id (unused)
    - Drop idx_transfer_registry_matched_transaction_id (unused)

  3. Views
    - Recreate views with explicit SECURITY INVOKER
*/

-- =====================================================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

-- Index for categorization_rules.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_categorization_rules_user_id_fkey 
  ON public.categorization_rules (user_id);

-- Index for contact_matching_rules.contact_id foreign key
CREATE INDEX IF NOT EXISTS idx_contact_matching_rules_contact_id_fkey 
  ON public.contact_matching_rules (contact_id);

-- Index for contact_matching_rules.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_contact_matching_rules_user_id_fkey 
  ON public.contact_matching_rules (user_id);

-- Index for profiles.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_profiles_user_id_fkey 
  ON public.profiles (user_id);

-- Index for transaction_splits.transaction_id foreign key
CREATE INDEX IF NOT EXISTS idx_transaction_splits_transaction_id_fkey 
  ON public.transaction_splits (transaction_id);

-- Index for transaction_splits.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_transaction_splits_user_id_fkey 
  ON public.transaction_splits (user_id);

-- Index for transfer_registry.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_transfer_registry_user_id_fkey 
  ON public.transfer_registry (user_id);

-- =====================================================
-- 2. REMOVE UNUSED INDEXES
-- =====================================================

DROP INDEX IF EXISTS public.idx_profile_tabs_profile_user_id;
DROP INDEX IF EXISTS public.idx_transaction_splits_category_account_id;
DROP INDEX IF EXISTS public.idx_transfer_registry_matched_transaction_id;

-- =====================================================
-- 3. RECREATE VIEWS WITH EXPLICIT SECURITY INVOKER
-- =====================================================

-- Drop existing views
DROP VIEW IF EXISTS public.v_property_accounts CASCADE;
DROP VIEW IF EXISTS public.v_balance_sheet_accounts CASCADE;
DROP VIEW IF EXISTS public.v_loan_accounts CASCADE;
DROP VIEW IF EXISTS public.v_active_accounts CASCADE;
DROP VIEW IF EXISTS public.v_investment_accounts CASCADE;
DROP VIEW IF EXISTS public.v_transactional_accounts CASCADE;
DROP VIEW IF EXISTS public.v_income_statement_accounts CASCADE;

-- Recreate with explicit SECURITY INVOKER
CREATE VIEW public.v_transactional_accounts WITH (security_invoker = true) AS
SELECT * FROM user_chart_of_accounts
WHERE account_detail IN ('checking_account', 'savings_account', 'credit_card')
AND is_active = true;

CREATE VIEW public.v_balance_sheet_accounts WITH (security_invoker = true) AS
SELECT * FROM user_chart_of_accounts
WHERE class IN ('asset', 'liability', 'equity')
AND is_active = true;

CREATE VIEW public.v_income_statement_accounts WITH (security_invoker = true) AS
SELECT * FROM user_chart_of_accounts
WHERE class IN ('income', 'expense')
AND is_active = true;

CREATE VIEW public.v_active_accounts WITH (security_invoker = true) AS
SELECT * FROM user_chart_of_accounts
WHERE is_active = true;

CREATE VIEW public.v_investment_accounts WITH (security_invoker = true) AS
SELECT * FROM user_chart_of_accounts
WHERE account_type = 'investments'
AND is_active = true;

CREATE VIEW public.v_property_accounts WITH (security_invoker = true) AS
SELECT * FROM user_chart_of_accounts
WHERE account_type = 'real_estate'
AND is_active = true;

CREATE VIEW public.v_loan_accounts WITH (security_invoker = true) AS
SELECT * FROM user_chart_of_accounts
WHERE account_type IN ('loans', 'mortgages')
AND is_active = true;
