/*
  # Create Convenience Views for Account Types

  ## Overview
  Create database views to simplify queries for different account types.
  These views filter user_chart_of_accounts by account type/detail.

  ## Views Created
  - v_transactional_accounts: Banking accounts (checking, savings, credit cards)
  - v_investment_accounts: Investment and retirement accounts
  - v_property_accounts: Real estate and vehicles
  - v_loan_accounts: All loans and mortgages
  - v_active_accounts: All currently active accounts
  - v_balance_sheet_accounts: All balance sheet accounts (assets, liabilities, equity)
  - v_income_statement_accounts: All P&L accounts (income, expense)
*/

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
