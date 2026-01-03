/*
  # Update RLS Policies for Profile-Based Access

  ## Overview
  Replaces user_id-based RLS policies with profile-based policies.
  All policies now use has_profile_access(profile_id) for consistent security.

  ## Changes
  - Drops old user_id-based policies
  - Creates new profile-based policies for all financial tables
  - Uses has_profile_access() helper function for consistency

  ## Tables Updated
  - accounts
  - transactions
  - budgets
  - budget_groups
  - contacts
  - credit_cards
  - bills
  - credit_scores
  - plaid_items
  - assets
  - liabilities
  - equity
  - asset_liability_links
  - user_chart_of_accounts
*/

-- ==========================================
-- ACCOUNTS
-- ==========================================

DROP POLICY IF EXISTS "Users can view own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can insert own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON accounts;

CREATE POLICY "Users can view accounts in their profiles"
  ON accounts
  FOR SELECT
  TO authenticated
  USING (has_profile_access(profile_id));

CREATE POLICY "Users can insert accounts in their profiles"
  ON accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can update accounts in their profiles"
  ON accounts
  FOR UPDATE
  TO authenticated
  USING (has_profile_access(profile_id))
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can delete accounts in their profiles"
  ON accounts
  FOR DELETE
  TO authenticated
  USING (has_profile_access(profile_id));

-- ==========================================
-- TRANSACTIONS
-- ==========================================

DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;

CREATE POLICY "Users can view transactions in their profiles"
  ON transactions
  FOR SELECT
  TO authenticated
  USING (has_profile_access(profile_id));

CREATE POLICY "Users can insert transactions in their profiles"
  ON transactions
  FOR INSERT
  TO authenticated
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can update transactions in their profiles"
  ON transactions
  FOR UPDATE
  TO authenticated
  USING (has_profile_access(profile_id))
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can delete transactions in their profiles"
  ON transactions
  FOR DELETE
  TO authenticated
  USING (has_profile_access(profile_id));

-- ==========================================
-- BUDGETS
-- ==========================================

DROP POLICY IF EXISTS "Users can view own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can insert own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can update own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can delete own budgets" ON budgets;

CREATE POLICY "Users can view budgets in their profiles"
  ON budgets
  FOR SELECT
  TO authenticated
  USING (has_profile_access(profile_id));

CREATE POLICY "Users can insert budgets in their profiles"
  ON budgets
  FOR INSERT
  TO authenticated
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can update budgets in their profiles"
  ON budgets
  FOR UPDATE
  TO authenticated
  USING (has_profile_access(profile_id))
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can delete budgets in their profiles"
  ON budgets
  FOR DELETE
  TO authenticated
  USING (has_profile_access(profile_id));

-- ==========================================
-- BUDGET_GROUPS
-- ==========================================

DROP POLICY IF EXISTS "Users can view own budget groups" ON budget_groups;
DROP POLICY IF EXISTS "Users can insert own budget groups" ON budget_groups;
DROP POLICY IF EXISTS "Users can update own budget groups" ON budget_groups;
DROP POLICY IF EXISTS "Users can delete own budget groups" ON budget_groups;

CREATE POLICY "Users can view budget groups in their profiles"
  ON budget_groups
  FOR SELECT
  TO authenticated
  USING (has_profile_access(profile_id));

CREATE POLICY "Users can insert budget groups in their profiles"
  ON budget_groups
  FOR INSERT
  TO authenticated
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can update budget groups in their profiles"
  ON budget_groups
  FOR UPDATE
  TO authenticated
  USING (has_profile_access(profile_id))
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can delete budget groups in their profiles"
  ON budget_groups
  FOR DELETE
  TO authenticated
  USING (has_profile_access(profile_id));

-- ==========================================
-- CONTACTS
-- ==========================================

DROP POLICY IF EXISTS "Users can view own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete own contacts" ON contacts;

CREATE POLICY "Users can view contacts in their profiles"
  ON contacts
  FOR SELECT
  TO authenticated
  USING (has_profile_access(profile_id));

CREATE POLICY "Users can insert contacts in their profiles"
  ON contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can update contacts in their profiles"
  ON contacts
  FOR UPDATE
  TO authenticated
  USING (has_profile_access(profile_id))
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can delete contacts in their profiles"
  ON contacts
  FOR DELETE
  TO authenticated
  USING (has_profile_access(profile_id));

-- ==========================================
-- CREDIT_CARDS
-- ==========================================

DROP POLICY IF EXISTS "Users can view own credit cards" ON credit_cards;
DROP POLICY IF EXISTS "Users can insert own credit cards" ON credit_cards;
DROP POLICY IF EXISTS "Users can update own credit cards" ON credit_cards;
DROP POLICY IF EXISTS "Users can delete own credit cards" ON credit_cards;

CREATE POLICY "Users can view credit cards in their profiles"
  ON credit_cards
  FOR SELECT
  TO authenticated
  USING (has_profile_access(profile_id));

CREATE POLICY "Users can insert credit cards in their profiles"
  ON credit_cards
  FOR INSERT
  TO authenticated
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can update credit cards in their profiles"
  ON credit_cards
  FOR UPDATE
  TO authenticated
  USING (has_profile_access(profile_id))
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can delete credit cards in their profiles"
  ON credit_cards
  FOR DELETE
  TO authenticated
  USING (has_profile_access(profile_id));

-- ==========================================
-- BILLS
-- ==========================================

DROP POLICY IF EXISTS "Users can view own bills" ON bills;
DROP POLICY IF EXISTS "Users can insert own bills" ON bills;
DROP POLICY IF EXISTS "Users can update own bills" ON bills;
DROP POLICY IF EXISTS "Users can delete own bills" ON bills;

CREATE POLICY "Users can view bills in their profiles"
  ON bills
  FOR SELECT
  TO authenticated
  USING (has_profile_access(profile_id));

CREATE POLICY "Users can insert bills in their profiles"
  ON bills
  FOR INSERT
  TO authenticated
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can update bills in their profiles"
  ON bills
  FOR UPDATE
  TO authenticated
  USING (has_profile_access(profile_id))
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can delete bills in their profiles"
  ON bills
  FOR DELETE
  TO authenticated
  USING (has_profile_access(profile_id));

-- ==========================================
-- CREDIT_SCORES
-- ==========================================

DROP POLICY IF EXISTS "Users can view own credit scores" ON credit_scores;
DROP POLICY IF EXISTS "Users can insert own credit scores" ON credit_scores;
DROP POLICY IF EXISTS "Users can update own credit scores" ON credit_scores;
DROP POLICY IF EXISTS "Users can delete own credit scores" ON credit_scores;

CREATE POLICY "Users can view credit scores in their profiles"
  ON credit_scores
  FOR SELECT
  TO authenticated
  USING (has_profile_access(profile_id));

CREATE POLICY "Users can insert credit scores in their profiles"
  ON credit_scores
  FOR INSERT
  TO authenticated
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can update credit scores in their profiles"
  ON credit_scores
  FOR UPDATE
  TO authenticated
  USING (has_profile_access(profile_id))
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can delete credit scores in their profiles"
  ON credit_scores
  FOR DELETE
  TO authenticated
  USING (has_profile_access(profile_id));

-- ==========================================
-- PLAID_ITEMS
-- ==========================================

DROP POLICY IF EXISTS "Users can view own plaid items" ON plaid_items;
DROP POLICY IF EXISTS "Users can insert own plaid items" ON plaid_items;
DROP POLICY IF EXISTS "Users can update own plaid items" ON plaid_items;
DROP POLICY IF EXISTS "Users can delete own plaid items" ON plaid_items;

CREATE POLICY "Users can view plaid items in their profiles"
  ON plaid_items
  FOR SELECT
  TO authenticated
  USING (has_profile_access(profile_id));

CREATE POLICY "Users can insert plaid items in their profiles"
  ON plaid_items
  FOR INSERT
  TO authenticated
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can update plaid items in their profiles"
  ON plaid_items
  FOR UPDATE
  TO authenticated
  USING (has_profile_access(profile_id))
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can delete plaid items in their profiles"
  ON plaid_items
  FOR DELETE
  TO authenticated
  USING (has_profile_access(profile_id));

-- ==========================================
-- ASSETS
-- ==========================================

DROP POLICY IF EXISTS "Users can view own assets" ON assets;
DROP POLICY IF EXISTS "Users can insert own assets" ON assets;
DROP POLICY IF EXISTS "Users can update own assets" ON assets;
DROP POLICY IF EXISTS "Users can delete own assets" ON assets;

CREATE POLICY "Users can view assets in their profiles"
  ON assets
  FOR SELECT
  TO authenticated
  USING (has_profile_access(profile_id));

CREATE POLICY "Users can insert assets in their profiles"
  ON assets
  FOR INSERT
  TO authenticated
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can update assets in their profiles"
  ON assets
  FOR UPDATE
  TO authenticated
  USING (has_profile_access(profile_id))
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can delete assets in their profiles"
  ON assets
  FOR DELETE
  TO authenticated
  USING (has_profile_access(profile_id));

-- ==========================================
-- LIABILITIES
-- ==========================================

DROP POLICY IF EXISTS "Users can view own liabilities" ON liabilities;
DROP POLICY IF EXISTS "Users can insert own liabilities" ON liabilities;
DROP POLICY IF EXISTS "Users can update own liabilities" ON liabilities;
DROP POLICY IF EXISTS "Users can delete own liabilities" ON liabilities;

CREATE POLICY "Users can view liabilities in their profiles"
  ON liabilities
  FOR SELECT
  TO authenticated
  USING (has_profile_access(profile_id));

CREATE POLICY "Users can insert liabilities in their profiles"
  ON liabilities
  FOR INSERT
  TO authenticated
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can update liabilities in their profiles"
  ON liabilities
  FOR UPDATE
  TO authenticated
  USING (has_profile_access(profile_id))
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can delete liabilities in their profiles"
  ON liabilities
  FOR DELETE
  TO authenticated
  USING (has_profile_access(profile_id));

-- ==========================================
-- EQUITY
-- ==========================================

DROP POLICY IF EXISTS "Users can view own equity" ON equity;
DROP POLICY IF EXISTS "Users can insert own equity" ON equity;
DROP POLICY IF EXISTS "Users can update own equity" ON equity;
DROP POLICY IF EXISTS "Users can delete own equity" ON equity;

CREATE POLICY "Users can view equity in their profiles"
  ON equity
  FOR SELECT
  TO authenticated
  USING (has_profile_access(profile_id));

CREATE POLICY "Users can insert equity in their profiles"
  ON equity
  FOR INSERT
  TO authenticated
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can update equity in their profiles"
  ON equity
  FOR UPDATE
  TO authenticated
  USING (has_profile_access(profile_id))
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can delete equity in their profiles"
  ON equity
  FOR DELETE
  TO authenticated
  USING (has_profile_access(profile_id));

-- ==========================================
-- ASSET_LIABILITY_LINKS
-- ==========================================

DROP POLICY IF EXISTS "Users can view own asset liability links" ON asset_liability_links;
DROP POLICY IF EXISTS "Users can insert own asset liability links" ON asset_liability_links;
DROP POLICY IF EXISTS "Users can update own asset liability links" ON asset_liability_links;
DROP POLICY IF EXISTS "Users can delete own asset liability links" ON asset_liability_links;

CREATE POLICY "Users can view asset liability links in their profiles"
  ON asset_liability_links
  FOR SELECT
  TO authenticated
  USING (has_profile_access(profile_id));

CREATE POLICY "Users can insert asset liability links in their profiles"
  ON asset_liability_links
  FOR INSERT
  TO authenticated
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can update asset liability links in their profiles"
  ON asset_liability_links
  FOR UPDATE
  TO authenticated
  USING (has_profile_access(profile_id))
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can delete asset liability links in their profiles"
  ON asset_liability_links
  FOR DELETE
  TO authenticated
  USING (has_profile_access(profile_id));

-- ==========================================
-- USER_CHART_OF_ACCOUNTS
-- ==========================================

DROP POLICY IF EXISTS "Users can view own chart of accounts" ON user_chart_of_accounts;
DROP POLICY IF EXISTS "Users can insert own chart of accounts" ON user_chart_of_accounts;
DROP POLICY IF EXISTS "Users can update own chart of accounts" ON user_chart_of_accounts;
DROP POLICY IF EXISTS "Users can delete own chart of accounts" ON user_chart_of_accounts;

CREATE POLICY "Users can view chart of accounts in their profiles"
  ON user_chart_of_accounts
  FOR SELECT
  TO authenticated
  USING (has_profile_access(profile_id));

CREATE POLICY "Users can insert chart of accounts in their profiles"
  ON user_chart_of_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can update chart of accounts in their profiles"
  ON user_chart_of_accounts
  FOR UPDATE
  TO authenticated
  USING (has_profile_access(profile_id))
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can delete chart of accounts in their profiles"
  ON user_chart_of_accounts
  FOR DELETE
  TO authenticated
  USING (has_profile_access(profile_id));
