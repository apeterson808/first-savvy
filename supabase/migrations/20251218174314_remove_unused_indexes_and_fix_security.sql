/*
  # Remove Unused Indexes and Fix Security Issues

  ## Changes Made
  
  ### 1. Removed Unused Indexes
  The following indexes were identified as unused and have been removed to improve database performance:
  - `idx_categories_user_id` on `categories` table
  - `idx_contacts_default_category_id` on `contacts` table
  - `idx_contacts_invitation_id` on `contacts` table
  - `idx_assets_user_id` on `assets` table
  - `idx_assets_parent_account_id` on `assets` table
  - `idx_liabilities_user_id` on `liabilities` table
  - `idx_liabilities_parent_account_id` on `liabilities` table
  - `idx_budgets_user_id` on `budgets` table
  - `idx_budgets_group_id` on `budgets` table
  - `idx_budgets_parent_budget_id` on `budgets` table
  - `idx_bank_accounts_user_id` on `bank_accounts` table
  - `idx_bank_accounts_parent_account_id` on `bank_accounts` table
  - `idx_credit_cards_user_id` on `credit_cards` table
  - `idx_payment_reminders_user_id` on `payment_reminders` table
  - `idx_payment_reminders_credit_card_id` on `payment_reminders` table

  ### 2. Removed Anonymous Access Policies
  All RLS policies allowing anonymous (anon) access have been removed.
  This financial application requires authenticated users only for security.

  ## Security Improvements
  - Reduced attack surface by removing anonymous access
  - Improved database performance by removing unused indexes
  - All data access now requires authentication
*/

-- Remove unused indexes
DROP INDEX IF EXISTS idx_categories_user_id;
DROP INDEX IF EXISTS idx_contacts_default_category_id;
DROP INDEX IF EXISTS idx_contacts_invitation_id;
DROP INDEX IF EXISTS idx_assets_user_id;
DROP INDEX IF EXISTS idx_assets_parent_account_id;
DROP INDEX IF EXISTS idx_liabilities_user_id;
DROP INDEX IF EXISTS idx_liabilities_parent_account_id;
DROP INDEX IF EXISTS idx_budgets_user_id;
DROP INDEX IF EXISTS idx_budgets_group_id;
DROP INDEX IF EXISTS idx_budgets_parent_budget_id;
DROP INDEX IF EXISTS idx_bank_accounts_user_id;
DROP INDEX IF EXISTS idx_bank_accounts_parent_account_id;
DROP INDEX IF EXISTS idx_credit_cards_user_id;
DROP INDEX IF EXISTS idx_payment_reminders_user_id;
DROP INDEX IF EXISTS idx_payment_reminders_credit_card_id;

-- Remove all anonymous access policies
-- Categories table
DROP POLICY IF EXISTS "Allow anon to insert categories" ON categories;
DROP POLICY IF EXISTS "Allow anon to select categories" ON categories;
DROP POLICY IF EXISTS "Allow anon to update categories" ON categories;
DROP POLICY IF EXISTS "Allow anon to delete categories" ON categories;

-- Transactions table
DROP POLICY IF EXISTS "Allow anon to insert transactions" ON transactions;
DROP POLICY IF EXISTS "Allow anon to select transactions" ON transactions;
DROP POLICY IF EXISTS "Allow anon to update transactions" ON transactions;
DROP POLICY IF EXISTS "Allow anon to delete transactions" ON transactions;

-- Bank accounts table
DROP POLICY IF EXISTS "Allow anon to insert bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Allow anon to select bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Allow anon to update bank_accounts" ON bank_accounts;
DROP POLICY IF EXISTS "Allow anon to delete bank_accounts" ON bank_accounts;

-- Budgets table
DROP POLICY IF EXISTS "Allow anon to insert budgets" ON budgets;
DROP POLICY IF EXISTS "Allow anon to select budgets" ON budgets;
DROP POLICY IF EXISTS "Allow anon to update budgets" ON budgets;
DROP POLICY IF EXISTS "Allow anon to delete budgets" ON budgets;

-- Budget groups table
DROP POLICY IF EXISTS "Allow anon to insert budget_groups" ON budget_groups;
DROP POLICY IF EXISTS "Allow anon to select budget_groups" ON budget_groups;
DROP POLICY IF EXISTS "Allow anon to update budget_groups" ON budget_groups;
DROP POLICY IF EXISTS "Allow anon to delete budget_groups" ON budget_groups;

-- Contacts table
DROP POLICY IF EXISTS "Allow anon to insert contacts" ON contacts;
DROP POLICY IF EXISTS "Allow anon to select contacts" ON contacts;
DROP POLICY IF EXISTS "Allow anon to update contacts" ON contacts;
DROP POLICY IF EXISTS "Allow anon to delete contacts" ON contacts;

-- Assets table
DROP POLICY IF EXISTS "Allow anon to insert assets" ON assets;
DROP POLICY IF EXISTS "Allow anon to select assets" ON assets;
DROP POLICY IF EXISTS "Allow anon to update assets" ON assets;
DROP POLICY IF EXISTS "Allow anon to delete assets" ON assets;

-- Liabilities table
DROP POLICY IF EXISTS "Allow anon to insert liabilities" ON liabilities;
DROP POLICY IF EXISTS "Allow anon to select liabilities" ON liabilities;
DROP POLICY IF EXISTS "Allow anon to update liabilities" ON liabilities;
DROP POLICY IF EXISTS "Allow anon to delete liabilities" ON liabilities;

-- Credit cards table
DROP POLICY IF EXISTS "Allow anon to insert credit_cards" ON credit_cards;
DROP POLICY IF EXISTS "Allow anon to select credit_cards" ON credit_cards;
DROP POLICY IF EXISTS "Allow anon to update credit_cards" ON credit_cards;
DROP POLICY IF EXISTS "Allow anon to delete credit_cards" ON credit_cards;

-- Payment reminders table
DROP POLICY IF EXISTS "Allow anon to insert payment_reminders" ON payment_reminders;
DROP POLICY IF EXISTS "Allow anon to select payment_reminders" ON payment_reminders;
DROP POLICY IF EXISTS "Allow anon to update payment_reminders" ON payment_reminders;
DROP POLICY IF EXISTS "Allow anon to delete payment_reminders" ON payment_reminders;

-- Bills table
DROP POLICY IF EXISTS "Allow anon to insert bills" ON bills;
DROP POLICY IF EXISTS "Allow anon to select bills" ON bills;
DROP POLICY IF EXISTS "Allow anon to update bills" ON bills;
DROP POLICY IF EXISTS "Allow anon to delete bills" ON bills;

-- Credit scores table
DROP POLICY IF EXISTS "Allow anon to insert credit_scores" ON credit_scores;
DROP POLICY IF EXISTS "Allow anon to select credit_scores" ON credit_scores;
DROP POLICY IF EXISTS "Allow anon to update credit_scores" ON credit_scores;
DROP POLICY IF EXISTS "Allow anon to delete credit_scores" ON credit_scores;

-- Categorization rules table
DROP POLICY IF EXISTS "Allow anon to insert categorization_rules" ON categorization_rules;
DROP POLICY IF EXISTS "Allow anon to select categorization_rules" ON categorization_rules;
DROP POLICY IF EXISTS "Allow anon to update categorization_rules" ON categorization_rules;
DROP POLICY IF EXISTS "Allow anon to delete categorization_rules" ON categorization_rules;

-- User profiles table
DROP POLICY IF EXISTS "Allow anon to insert user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow anon to select user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow anon to update user_profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow anon to delete user_profiles" ON user_profiles;