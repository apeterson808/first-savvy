/*
  # Remove All Plaid Integration

  ## Overview
  This migration completely removes all Plaid-related database artifacts from the system.
  The app uses manual entry and statement file parsing only, so Plaid integration is unnecessary.

  ## Changes Made

  ### 1. Drop plaid_items Table
  - Removes the entire plaid_items table and all associated data
  - This table was never fully utilized

  ### 2. Remove Plaid Columns from user_chart_of_accounts
  - `plaid_account_id` - Plaid account identifier
  - `plaid_item_id` - Plaid item identifier  
  - `last_sync_date` - Last Plaid sync timestamp

  ### 3. Drop and Recreate Views
  - Drops all dependent views
  - Recreates them without Plaid columns
  - Views continue to work with remaining columns

  ### 4. Drop Plaid-Related Indexes
  - `idx_user_coa_plaid_account_id` - Unique index on plaid_account_id
  - `idx_user_coa_plaid_item` - Index on plaid_item_id

  ## Impact
  - No data loss for actual accounts (all user data preserved)
  - Simplifies database schema
  - Removes misleading integration references
  - Account creation wizard will be simplified to manual entry and file upload only

  ## Security Notes
  - All user financial data remains intact
  - Only removes unused Plaid-specific fields
  - No impact on existing accounts or transactions
*/

-- Drop plaid_items table if it exists
DROP TABLE IF EXISTS plaid_items CASCADE;

-- Drop Plaid-related indexes from user_chart_of_accounts
DROP INDEX IF EXISTS idx_user_coa_plaid_account_id;
DROP INDEX IF EXISTS idx_user_coa_plaid_item;

-- Remove Plaid columns from user_chart_of_accounts (CASCADE drops dependent views)
ALTER TABLE user_chart_of_accounts
DROP COLUMN IF EXISTS plaid_account_id CASCADE,
DROP COLUMN IF EXISTS plaid_item_id CASCADE,
DROP COLUMN IF EXISTS last_sync_date CASCADE;

-- Recreate the convenience views that were dropped
-- View: Transactional Accounts (Banking)
CREATE OR REPLACE VIEW v_transactional_accounts AS
SELECT
  ucoa.*,
  COALESCE(ucoa.display_name, t.display_name) as effective_display_name
FROM user_chart_of_accounts ucoa
LEFT JOIN chart_of_accounts_templates t ON ucoa.template_account_number = t.account_number
WHERE ucoa.account_detail IN (
  'checking_account',
  'savings_account',
  'money_market',
  'credit_card',
  'cash'
)
ORDER BY ucoa.user_id, ucoa.account_number;

-- View: Investment Accounts
CREATE OR REPLACE VIEW v_investment_accounts AS
SELECT
  ucoa.*,
  COALESCE(ucoa.display_name, t.display_name) as effective_display_name
FROM user_chart_of_accounts ucoa
LEFT JOIN chart_of_accounts_templates t ON ucoa.template_account_number = t.account_number
WHERE ucoa.account_detail IN (
  'investment_taxable',
  'investment_retirement_401k',
  'investment_retirement_ira',
  'investment_retirement_roth_ira',
  'investment_retirement_pension',
  'investment_retirement_other',
  'investment_education_529',
  'investment_education_coverdell',
  'investment_hsa'
)
ORDER BY ucoa.user_id, ucoa.account_number;

-- View: Property Accounts
CREATE OR REPLACE VIEW v_property_accounts AS
SELECT
  ucoa.*,
  COALESCE(ucoa.display_name, t.display_name) as effective_display_name
FROM user_chart_of_accounts ucoa
LEFT JOIN chart_of_accounts_templates t ON ucoa.template_account_number = t.account_number
WHERE ucoa.account_detail IN (
  'fixed_asset_property',
  'fixed_asset_vehicle'
)
ORDER BY ucoa.user_id, ucoa.account_number;

-- View: Loan Accounts
CREATE OR REPLACE VIEW v_loan_accounts AS
SELECT
  ucoa.*,
  COALESCE(ucoa.display_name, t.display_name) as effective_display_name
FROM user_chart_of_accounts ucoa
LEFT JOIN chart_of_accounts_templates t ON ucoa.template_account_number = t.account_number
WHERE ucoa.account_detail IN (
  'mortgage',
  'auto_loan',
  'student_loan',
  'personal_loan',
  'business_loan',
  'other_loan'
)
ORDER BY ucoa.user_id, ucoa.account_number;

-- View: Active Accounts
CREATE OR REPLACE VIEW v_active_accounts AS
SELECT
  ucoa.*,
  COALESCE(ucoa.display_name, t.display_name) as effective_display_name
FROM user_chart_of_accounts ucoa
LEFT JOIN chart_of_accounts_templates t ON ucoa.template_account_number = t.account_number
WHERE ucoa.is_active = true
  AND ucoa.is_closed = false
ORDER BY ucoa.user_id, ucoa.account_number;

-- View: Balance Sheet Accounts (Assets, Liabilities, Equity)
CREATE OR REPLACE VIEW v_balance_sheet_accounts AS
SELECT
  ucoa.*,
  COALESCE(ucoa.display_name, t.display_name) as effective_display_name
FROM user_chart_of_accounts ucoa
LEFT JOIN chart_of_accounts_templates t ON ucoa.template_account_number = t.account_number
WHERE ucoa.class IN ('asset', 'liability', 'equity')
ORDER BY ucoa.user_id, ucoa.class, ucoa.account_number;

-- View: Income Statement Accounts (Income, Expense)
CREATE OR REPLACE VIEW v_income_statement_accounts AS
SELECT
  ucoa.*,
  COALESCE(ucoa.display_name, t.display_name) as effective_display_name
FROM user_chart_of_accounts ucoa
LEFT JOIN chart_of_accounts_templates t ON ucoa.template_account_number = t.account_number
WHERE ucoa.class IN ('income', 'expense')
ORDER BY ucoa.user_id, ucoa.class, ucoa.account_number;

-- Add comments for documentation
COMMENT ON VIEW v_transactional_accounts IS 'Banking accounts: checking, savings, credit cards, cash';
COMMENT ON VIEW v_investment_accounts IS 'Investment and retirement accounts: 401k, IRA, Roth IRA, 529, HSA, etc.';
COMMENT ON VIEW v_property_accounts IS 'Physical asset accounts: real estate properties and vehicles';
COMMENT ON VIEW v_loan_accounts IS 'Liability accounts: mortgages, auto loans, student loans, personal loans';
COMMENT ON VIEW v_active_accounts IS 'All currently active accounts (not closed)';
COMMENT ON VIEW v_balance_sheet_accounts IS 'All balance sheet accounts: assets, liabilities, equity';
COMMENT ON VIEW v_income_statement_accounts IS 'All income statement accounts: income and expenses';