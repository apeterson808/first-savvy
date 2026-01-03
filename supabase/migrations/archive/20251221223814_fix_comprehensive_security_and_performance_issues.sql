/*
  # Comprehensive Security and Performance Fixes
  
  ## Overview
  This migration addresses multiple security and performance issues identified in the database audit:
  
  ## Changes Made
  
  ### 1. Missing Foreign Key Indexes
  - Add index on bank_accounts.parent_account_id
  - Add index on categories.parent_account_id
  - Add index on configuration_change_log.user_id
  - Add index on contacts.default_category_id
  - Add index on credit_cards.parent_account_id
  
  ### 2. RLS Performance Optimization
  - Replace `auth.uid()` with `(select auth.uid())` in all RLS policies
  - This prevents re-evaluation of auth function for each row, improving query performance
  - Affects all tables: accounts, bank_accounts, credit_cards, transactions, contacts, budgets, 
    budget_groups, categories, assets, liabilities, equity, credit_scores, plaid_items, configuration_change_log
  
  ### 3. Remove Unused Indexes
  - Remove indexes that have never been used to improve write performance and save storage
  - Includes indexes on is_active, email, phone, plaid fields, and other unused columns
  
  ### 4. Remove Duplicate RLS Policies
  - Remove duplicate policies on budget_groups (keeping snake_case versions)
  - Remove duplicate policies on credit_scores (keeping snake_case versions)
  
  ### 5. Fix Function Security
  - Add immutable search_path to all trigger functions to prevent search_path attacks
  
  ### 6. Enable RLS on category_templates
  - Enable RLS and add appropriate policies for category_templates table
  
  ## Security Impact
  - Improves RLS performance while maintaining security
  - Fixes function search path vulnerabilities
  - Enables RLS on exposed table
  
  ## Performance Impact
  - Adds needed indexes for foreign keys (improves join performance)
  - Removes unused indexes (improves write performance)
  - Optimizes RLS evaluation (improves query performance)
*/

-- =======================
-- 1. ADD MISSING FOREIGN KEY INDEXES
-- =======================

CREATE INDEX IF NOT EXISTS idx_bank_accounts_parent_account_id 
  ON bank_accounts(parent_account_id);

CREATE INDEX IF NOT EXISTS idx_categories_parent_account_id 
  ON categories(parent_account_id);

CREATE INDEX IF NOT EXISTS idx_configuration_change_log_user_id 
  ON configuration_change_log(user_id);

CREATE INDEX IF NOT EXISTS idx_contacts_default_category_id 
  ON contacts(default_category_id);

CREATE INDEX IF NOT EXISTS idx_credit_cards_parent_account_id 
  ON credit_cards(parent_account_id);

-- =======================
-- 2. OPTIMIZE RLS POLICIES - Replace auth.uid() with (select auth.uid())
-- =======================

-- Drop and recreate all policies with optimized auth.uid() calls

-- BANK_ACCOUNTS
DROP POLICY IF EXISTS "Users can view own bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Users can insert own bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Users can update own bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Users can delete own bank accounts" ON bank_accounts;

CREATE POLICY "Users can view own bank accounts"
  ON bank_accounts FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own bank accounts"
  ON bank_accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own bank accounts"
  ON bank_accounts FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own bank accounts"
  ON bank_accounts FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- CREDIT_CARDS
DROP POLICY IF EXISTS "Users can view own credit cards" ON credit_cards;
DROP POLICY IF EXISTS "Users can insert own credit cards" ON credit_cards;
DROP POLICY IF EXISTS "Users can update own credit cards" ON credit_cards;
DROP POLICY IF EXISTS "Users can delete own credit cards" ON credit_cards;

CREATE POLICY "Users can view own credit cards"
  ON credit_cards FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own credit cards"
  ON credit_cards FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own credit cards"
  ON credit_cards FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own credit cards"
  ON credit_cards FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- CONFIGURATION_CHANGE_LOG
DROP POLICY IF EXISTS "Authenticated users can insert change logs" ON configuration_change_log;

CREATE POLICY "Authenticated users can insert change logs"
  ON configuration_change_log FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

-- ACCOUNTS
DROP POLICY IF EXISTS "Users can view own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can insert own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON accounts;

CREATE POLICY "Users can view own accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own accounts"
  ON accounts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own accounts"
  ON accounts FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own accounts"
  ON accounts FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- CONTACTS
DROP POLICY IF EXISTS "Users can view own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete own contacts" ON contacts;

CREATE POLICY "Users can view own contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own contacts"
  ON contacts FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- BUDGET_GROUPS (also remove duplicates)
DROP POLICY IF EXISTS "Users can view own budget_groups" ON budget_groups;
DROP POLICY IF EXISTS "Users can view own budget groups" ON budget_groups;
DROP POLICY IF EXISTS "Users can insert own budget_groups" ON budget_groups;
DROP POLICY IF EXISTS "Users can insert own budget groups" ON budget_groups;
DROP POLICY IF EXISTS "Users can update own budget_groups" ON budget_groups;
DROP POLICY IF EXISTS "Users can update own budget groups" ON budget_groups;
DROP POLICY IF EXISTS "Users can delete own budget_groups" ON budget_groups;
DROP POLICY IF EXISTS "Users can delete own budget groups" ON budget_groups;

CREATE POLICY "Users can view own budget_groups"
  ON budget_groups FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own budget_groups"
  ON budget_groups FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own budget_groups"
  ON budget_groups FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own budget_groups"
  ON budget_groups FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- BUDGETS
DROP POLICY IF EXISTS "Users can view own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can insert own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can update own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can delete own budgets" ON budgets;

CREATE POLICY "Users can view own budgets"
  ON budgets FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own budgets"
  ON budgets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own budgets"
  ON budgets FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own budgets"
  ON budgets FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- CREDIT_SCORES (also remove duplicates)
DROP POLICY IF EXISTS "Users can view own credit_scores" ON credit_scores;
DROP POLICY IF EXISTS "Users can view own credit scores" ON credit_scores;
DROP POLICY IF EXISTS "Users can insert own credit_scores" ON credit_scores;
DROP POLICY IF EXISTS "Users can insert own credit scores" ON credit_scores;
DROP POLICY IF EXISTS "Users can update own credit_scores" ON credit_scores;
DROP POLICY IF EXISTS "Users can update own credit scores" ON credit_scores;
DROP POLICY IF EXISTS "Users can delete own credit_scores" ON credit_scores;
DROP POLICY IF EXISTS "Users can delete own credit scores" ON credit_scores;

CREATE POLICY "Users can view own credit_scores"
  ON credit_scores FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own credit_scores"
  ON credit_scores FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own credit_scores"
  ON credit_scores FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own credit_scores"
  ON credit_scores FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- ASSETS
DROP POLICY IF EXISTS "Users can view own assets" ON assets;
DROP POLICY IF EXISTS "Users can insert own assets" ON assets;
DROP POLICY IF EXISTS "Users can update own assets" ON assets;
DROP POLICY IF EXISTS "Users can delete own assets" ON assets;

CREATE POLICY "Users can view own assets"
  ON assets FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own assets"
  ON assets FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own assets"
  ON assets FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own assets"
  ON assets FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- LIABILITIES
DROP POLICY IF EXISTS "Users can view own liabilities" ON liabilities;
DROP POLICY IF EXISTS "Users can insert own liabilities" ON liabilities;
DROP POLICY IF EXISTS "Users can update own liabilities" ON liabilities;
DROP POLICY IF EXISTS "Users can delete own liabilities" ON liabilities;

CREATE POLICY "Users can view own liabilities"
  ON liabilities FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own liabilities"
  ON liabilities FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own liabilities"
  ON liabilities FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own liabilities"
  ON liabilities FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- CATEGORIES
DROP POLICY IF EXISTS "Users can view own categories" ON categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON categories;
DROP POLICY IF EXISTS "Users can update own categories" ON categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON categories;

CREATE POLICY "Users can view own categories"
  ON categories FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own categories"
  ON categories FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- EQUITY
DROP POLICY IF EXISTS "Users can view own equity accounts" ON equity;
DROP POLICY IF EXISTS "Users can insert own equity accounts" ON equity;
DROP POLICY IF EXISTS "Users can update own equity accounts" ON equity;
DROP POLICY IF EXISTS "Users can delete own equity accounts" ON equity;

CREATE POLICY "Users can view own equity accounts"
  ON equity FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own equity accounts"
  ON equity FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own equity accounts"
  ON equity FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own equity accounts"
  ON equity FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- PLAID_ITEMS
DROP POLICY IF EXISTS "Users can view own plaid items" ON plaid_items;
DROP POLICY IF EXISTS "Users can insert own plaid items" ON plaid_items;
DROP POLICY IF EXISTS "Users can update own plaid items" ON plaid_items;
DROP POLICY IF EXISTS "Users can delete own plaid items" ON plaid_items;

CREATE POLICY "Users can view own plaid items"
  ON plaid_items FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own plaid items"
  ON plaid_items FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own plaid items"
  ON plaid_items FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own plaid items"
  ON plaid_items FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- TRANSACTIONS
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (user_id = (select auth.uid()));

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING (user_id = (select auth.uid()))
  WITH CHECK (user_id = (select auth.uid()));

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING (user_id = (select auth.uid()));

-- =======================
-- 3. REMOVE UNUSED INDEXES
-- =======================

DROP INDEX IF EXISTS idx_bank_accounts_is_active;
DROP INDEX IF EXISTS idx_credit_cards_is_active;
DROP INDEX IF EXISTS idx_accounts_is_active;
DROP INDEX IF EXISTS idx_contacts_email;
DROP INDEX IF EXISTS idx_contacts_phone;
DROP INDEX IF EXISTS idx_contacts_connection_status;
DROP INDEX IF EXISTS idx_contacts_linked_user_id;
DROP INDEX IF EXISTS idx_contacts_type;
DROP INDEX IF EXISTS idx_accounts_plaid_account_id;
DROP INDEX IF EXISTS idx_accounts_plaid_item_id;
DROP INDEX IF EXISTS idx_transactions_plaid_transaction_id;
DROP INDEX IF EXISTS idx_accounts_is_overdue;
DROP INDEX IF EXISTS idx_accounts_next_payment_due_date;
DROP INDEX IF EXISTS idx_plaid_items_user_id;
DROP INDEX IF EXISTS idx_plaid_items_item_id;
DROP INDEX IF EXISTS idx_plaid_items_status;
DROP INDEX IF EXISTS idx_assets_parent_account_id;
DROP INDEX IF EXISTS idx_liabilities_parent_account_id;
DROP INDEX IF EXISTS idx_liabilities_user_id;
DROP INDEX IF EXISTS idx_equity_parent_account_id;
DROP INDEX IF EXISTS idx_equity_is_active;
DROP INDEX IF EXISTS idx_configuration_change_log_config_id;
DROP INDEX IF EXISTS idx_configuration_change_log_created_at;
DROP INDEX IF EXISTS idx_user_profiles_profile_type;
DROP INDEX IF EXISTS idx_transactions_account_id;
DROP INDEX IF EXISTS idx_transactions_original_type;

-- =======================
-- 4. FIX FUNCTION SEARCH PATH SECURITY
-- =======================

CREATE OR REPLACE FUNCTION update_protected_configuration_timestamp()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_equity_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_contact_matching_rules_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_accounts_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_bank_accounts_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION update_credit_cards_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_transaction_account_ids()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.bank_account_id IS NOT NULL THEN
    SELECT account_id INTO NEW.account_id
    FROM bank_accounts
    WHERE id = NEW.bank_account_id;
  END IF;
  
  IF NEW.credit_card_id IS NOT NULL THEN
    SELECT account_id INTO NEW.account_id
    FROM credit_cards
    WHERE id = NEW.credit_card_id;
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_transaction_fields()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF OLD.bank_account_id IS DISTINCT FROM NEW.bank_account_id THEN
      IF NEW.bank_account_id IS NOT NULL THEN
        SELECT account_id INTO NEW.account_id
        FROM bank_accounts
        WHERE id = NEW.bank_account_id;
      END IF;
    END IF;

    IF OLD.credit_card_id IS DISTINCT FROM NEW.credit_card_id THEN
      IF NEW.credit_card_id IS NOT NULL THEN
        SELECT account_id INTO NEW.account_id
        FROM credit_cards
        WHERE id = NEW.credit_card_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION sync_bank_accounts_to_accounts()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public, pg_temp
LANGUAGE plpgsql
AS $$
DECLARE
  v_account_id uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO accounts (
      user_id,
      name,
      account_type,
      institution_name,
      current_balance,
      available_balance,
      currency,
      is_active,
      last_synced_at
    ) VALUES (
      NEW.user_id,
      NEW.name,
      NEW.account_type,
      NEW.institution_name,
      NEW.current_balance,
      NEW.available_balance,
      NEW.currency,
      NEW.is_active,
      NEW.last_synced_at
    ) RETURNING id INTO v_account_id;
    
    NEW.account_id := v_account_id;
    
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.account_id IS NOT NULL THEN
      UPDATE accounts SET
        name = NEW.name,
        account_type = NEW.account_type,
        institution_name = NEW.institution_name,
        current_balance = NEW.current_balance,
        available_balance = NEW.available_balance,
        currency = NEW.currency,
        is_active = NEW.is_active,
        last_synced_at = NEW.last_synced_at,
        updated_at = now()
      WHERE id = NEW.account_id;
    END IF;
    
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.account_id IS NOT NULL THEN
      DELETE FROM accounts WHERE id = OLD.account_id;
    END IF;
    RETURN OLD;
  END IF;
  
  RETURN NEW;
END;
$$;

-- =======================
-- 5. ENABLE RLS ON CATEGORY_TEMPLATES
-- =======================

ALTER TABLE category_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view category templates"
  ON category_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only service role can modify templates"
  ON category_templates FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
