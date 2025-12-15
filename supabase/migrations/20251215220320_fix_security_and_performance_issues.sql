/*
  # Fix Security and Performance Issues
  
  ## Overview
  This migration addresses critical security and performance issues identified in the Supabase security scan.
  
  ## Changes Made
  
  ### 1. Add Missing Foreign Key Indexes (17 indexes)
  Foreign keys without indexes cause poor query performance. Adding indexes for:
  - assets.user_id
  - bills.category_id, user_id
  - budget_groups.user_id
  - budgets.category_id, group_id
  - categories.parent_account_id
  - categorization_rules.category_id, user_id
  - contacts.user_id
  - credit_cards.user_id
  - credit_scores.user_id
  - liabilities.user_id
  - transactions.ai_suggested_category_id, ai_suggested_contact_id, category_id, transfer_account_id
  
  ### 2. Optimize RLS Policies (48 policies for authenticated users)
  Replace auth.uid() with (select auth.uid()) to avoid per-row function re-evaluation.
  This significantly improves query performance at scale by evaluating auth.uid() once per query instead of once per row.
  
  All RLS policies are updated for tables:
  - bank_accounts (4 policies)
  - categories (4 policies)
  - transactions (4 policies)
  - budget_groups (4 policies)
  - budgets (4 policies)
  - contacts (4 policies)
  - assets (4 policies)
  - liabilities (4 policies)
  - credit_cards (4 policies)
  - bills (4 policies)
  - credit_scores (4 policies)
  - categorization_rules (4 policies)
  
  ### 3. Notes
  - Existing anonymous user policies are preserved
  - Unused indexes warnings are informational only
  - Auth connection strategy and leaked password protection must be configured in Supabase Dashboard
*/

-- =====================================================
-- PART 1: ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_category_id ON bills(category_id);
CREATE INDEX IF NOT EXISTS idx_bills_user_id ON bills(user_id);
CREATE INDEX IF NOT EXISTS idx_budget_groups_user_id ON budget_groups(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_category_id ON budgets(category_id);
CREATE INDEX IF NOT EXISTS idx_budgets_group_id ON budgets(group_id);
CREATE INDEX IF NOT EXISTS idx_categories_parent_account_id ON categories(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_categorization_rules_category_id ON categorization_rules(category_id);
CREATE INDEX IF NOT EXISTS idx_categorization_rules_user_id ON categorization_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_contacts_user_id ON contacts(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_cards_user_id ON credit_cards(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_scores_user_id ON credit_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_liabilities_user_id ON liabilities(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_ai_suggested_category_id ON transactions(ai_suggested_category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_ai_suggested_contact_id ON transactions(ai_suggested_contact_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category_id ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_account_id ON transactions(transfer_account_id);

-- =====================================================
-- PART 2: OPTIMIZE RLS POLICIES
-- =====================================================

-- BANK_ACCOUNTS POLICIES
DROP POLICY IF EXISTS "Users can view own bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Users can insert own bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Users can update own bank accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Users can delete own bank accounts" ON bank_accounts;

CREATE POLICY "Users can view own bank accounts"
  ON bank_accounts FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own bank accounts"
  ON bank_accounts FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own bank accounts"
  ON bank_accounts FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own bank accounts"
  ON bank_accounts FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- CATEGORIES POLICIES
DROP POLICY IF EXISTS "Users can view own categories" ON categories;
DROP POLICY IF EXISTS "Users can insert own categories" ON categories;
DROP POLICY IF EXISTS "Users can update own categories" ON categories;
DROP POLICY IF EXISTS "Users can delete own categories" ON categories;

CREATE POLICY "Users can view own categories"
  ON categories FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id OR is_system = true);

CREATE POLICY "Users can insert own categories"
  ON categories FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own categories"
  ON categories FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own categories"
  ON categories FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- TRANSACTIONS POLICIES
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;

CREATE POLICY "Users can view own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own transactions"
  ON transactions FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own transactions"
  ON transactions FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own transactions"
  ON transactions FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- BUDGET_GROUPS POLICIES
DROP POLICY IF EXISTS "Users can view own budget groups" ON budget_groups;
DROP POLICY IF EXISTS "Users can insert own budget groups" ON budget_groups;
DROP POLICY IF EXISTS "Users can update own budget groups" ON budget_groups;
DROP POLICY IF EXISTS "Users can delete own budget groups" ON budget_groups;

CREATE POLICY "Users can view own budget groups"
  ON budget_groups FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own budget groups"
  ON budget_groups FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own budget groups"
  ON budget_groups FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own budget groups"
  ON budget_groups FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- BUDGETS POLICIES
DROP POLICY IF EXISTS "Users can view own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can insert own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can update own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can delete own budgets" ON budgets;

CREATE POLICY "Users can view own budgets"
  ON budgets FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own budgets"
  ON budgets FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own budgets"
  ON budgets FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own budgets"
  ON budgets FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- CONTACTS POLICIES
DROP POLICY IF EXISTS "Users can view own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete own contacts" ON contacts;

CREATE POLICY "Users can view own contacts"
  ON contacts FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own contacts"
  ON contacts FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own contacts"
  ON contacts FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own contacts"
  ON contacts FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- ASSETS POLICIES
DROP POLICY IF EXISTS "Users can view own assets" ON assets;
DROP POLICY IF EXISTS "Users can insert own assets" ON assets;
DROP POLICY IF EXISTS "Users can update own assets" ON assets;
DROP POLICY IF EXISTS "Users can delete own assets" ON assets;

CREATE POLICY "Users can view own assets"
  ON assets FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own assets"
  ON assets FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own assets"
  ON assets FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own assets"
  ON assets FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- LIABILITIES POLICIES
DROP POLICY IF EXISTS "Users can view own liabilities" ON liabilities;
DROP POLICY IF EXISTS "Users can insert own liabilities" ON liabilities;
DROP POLICY IF EXISTS "Users can update own liabilities" ON liabilities;
DROP POLICY IF EXISTS "Users can delete own liabilities" ON liabilities;

CREATE POLICY "Users can view own liabilities"
  ON liabilities FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own liabilities"
  ON liabilities FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own liabilities"
  ON liabilities FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own liabilities"
  ON liabilities FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- CREDIT_CARDS POLICIES
DROP POLICY IF EXISTS "Users can view own credit cards" ON credit_cards;
DROP POLICY IF EXISTS "Users can insert own credit cards" ON credit_cards;
DROP POLICY IF EXISTS "Users can update own credit cards" ON credit_cards;
DROP POLICY IF EXISTS "Users can delete own credit cards" ON credit_cards;

CREATE POLICY "Users can view own credit cards"
  ON credit_cards FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own credit cards"
  ON credit_cards FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own credit cards"
  ON credit_cards FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own credit cards"
  ON credit_cards FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- BILLS POLICIES
DROP POLICY IF EXISTS "Users can view own bills" ON bills;
DROP POLICY IF EXISTS "Users can insert own bills" ON bills;
DROP POLICY IF EXISTS "Users can update own bills" ON bills;
DROP POLICY IF EXISTS "Users can delete own bills" ON bills;

CREATE POLICY "Users can view own bills"
  ON bills FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own bills"
  ON bills FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own bills"
  ON bills FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own bills"
  ON bills FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- CREDIT_SCORES POLICIES
DROP POLICY IF EXISTS "Users can view own credit scores" ON credit_scores;
DROP POLICY IF EXISTS "Users can insert own credit scores" ON credit_scores;
DROP POLICY IF EXISTS "Users can update own credit scores" ON credit_scores;
DROP POLICY IF EXISTS "Users can delete own credit scores" ON credit_scores;

CREATE POLICY "Users can view own credit scores"
  ON credit_scores FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own credit scores"
  ON credit_scores FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own credit scores"
  ON credit_scores FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own credit scores"
  ON credit_scores FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- CATEGORIZATION_RULES POLICIES
DROP POLICY IF EXISTS "Users can view own categorization rules" ON categorization_rules;
DROP POLICY IF EXISTS "Users can insert own categorization rules" ON categorization_rules;
DROP POLICY IF EXISTS "Users can update own categorization rules" ON categorization_rules;
DROP POLICY IF EXISTS "Users can delete own categorization rules" ON categorization_rules;

CREATE POLICY "Users can view own categorization rules"
  ON categorization_rules FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can insert own categorization rules"
  ON categorization_rules FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can update own categorization rules"
  ON categorization_rules FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own categorization rules"
  ON categorization_rules FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);