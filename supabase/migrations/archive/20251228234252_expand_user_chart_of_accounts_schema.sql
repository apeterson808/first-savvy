/*
  # Expand user_chart_of_accounts to Store All Account Data

  ## Overview
  This migration transforms user_chart_of_accounts into the single source of truth
  for ALL account data. Previously, account data was split across multiple tables
  (accounts, assets, liabilities, equity). Now everything is consolidated here.

  ## New Columns Added

  ### Balance and Financial Data
  - `current_balance` - Current account balance/value
  - `available_balance` - Available balance (for checking/credit)
  - `statement_balance` - Statement balance (for credit cards)

  ### Institution Details
  - `institution_name` - Financial institution name
  - `account_number_last4` - Last 4 digits of account number
  - `official_name` - Official account name from institution
  - `routing_number` - Bank routing number

  ### Credit Card Specific
  - `credit_limit` - Credit card limit
  - `interest_rate` - APR/interest rate
  - `minimum_payment` - Minimum payment due
  - `payment_due_date` - Payment due date
  - `statement_closing_date` - Statement closing date

  ### Loan/Mortgage Specific
  - `original_amount` - Original loan/mortgage amount
  - `loan_term_months` - Loan term in months
  - `maturity_date` - Loan maturity date
  - `monthly_payment` - Monthly payment amount

  ### Asset/Investment Specific
  - `purchase_date` - Purchase/acquisition date
  - `purchase_price` - Original purchase price
  - `cost_basis` - Investment cost basis

  ### Plaid Integration
  - `plaid_account_id` - Plaid account identifier (unique)
  - `plaid_item_id` - Plaid item identifier
  - `last_sync_date` - Last Plaid sync timestamp

  ### Status and Metadata
  - `is_closed` - Whether account is closed
  - `include_in_net_worth` - Include in net worth calculations
  - `notes` - User notes about the account
  - `start_date` - Account start/open date
  - `display_in_sidebar` - Show account in sidebar navigation

  ## Indexes
  - Performance indexes for common queries
  - Unique index on plaid_account_id
  - Composite indexes for filtering
*/

-- Add balance and financial data columns
ALTER TABLE user_chart_of_accounts
ADD COLUMN IF NOT EXISTS current_balance numeric(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS available_balance numeric(15,2),
ADD COLUMN IF NOT EXISTS statement_balance numeric(15,2);

-- Add institution details
ALTER TABLE user_chart_of_accounts
ADD COLUMN IF NOT EXISTS institution_name text,
ADD COLUMN IF NOT EXISTS account_number_last4 text,
ADD COLUMN IF NOT EXISTS official_name text,
ADD COLUMN IF NOT EXISTS routing_number text;

-- Add credit card specific fields
ALTER TABLE user_chart_of_accounts
ADD COLUMN IF NOT EXISTS credit_limit numeric(15,2),
ADD COLUMN IF NOT EXISTS interest_rate numeric(5,2),
ADD COLUMN IF NOT EXISTS minimum_payment numeric(15,2),
ADD COLUMN IF NOT EXISTS payment_due_date date,
ADD COLUMN IF NOT EXISTS statement_closing_date date;

-- Add loan/mortgage specific fields
ALTER TABLE user_chart_of_accounts
ADD COLUMN IF NOT EXISTS original_amount numeric(15,2),
ADD COLUMN IF NOT EXISTS loan_term_months integer,
ADD COLUMN IF NOT EXISTS maturity_date date,
ADD COLUMN IF NOT EXISTS monthly_payment numeric(15,2);

-- Add asset/investment specific fields
ALTER TABLE user_chart_of_accounts
ADD COLUMN IF NOT EXISTS purchase_date date,
ADD COLUMN IF NOT EXISTS purchase_price numeric(15,2),
ADD COLUMN IF NOT EXISTS cost_basis numeric(15,2);

-- Add Plaid integration fields
ALTER TABLE user_chart_of_accounts
ADD COLUMN IF NOT EXISTS plaid_account_id text,
ADD COLUMN IF NOT EXISTS plaid_item_id text,
ADD COLUMN IF NOT EXISTS last_sync_date timestamptz;

-- Add status and metadata fields
ALTER TABLE user_chart_of_accounts
ADD COLUMN IF NOT EXISTS is_closed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS include_in_net_worth boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS notes text,
ADD COLUMN IF NOT EXISTS start_date date,
ADD COLUMN IF NOT EXISTS display_in_sidebar boolean DEFAULT false;

-- Create unique constraint on plaid_account_id (where not null)
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_coa_plaid_account_id
ON user_chart_of_accounts(plaid_account_id)
WHERE plaid_account_id IS NOT NULL;

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_user_coa_type_active_networth
ON user_chart_of_accounts(user_id, account_type, is_active, include_in_net_worth);

CREATE INDEX IF NOT EXISTS idx_user_coa_detail_active
ON user_chart_of_accounts(user_id, account_detail, is_active);

CREATE INDEX IF NOT EXISTS idx_user_coa_plaid_item
ON user_chart_of_accounts(plaid_item_id)
WHERE plaid_item_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_user_coa_closed
ON user_chart_of_accounts(user_id, is_closed);

-- Add comments for documentation
COMMENT ON COLUMN user_chart_of_accounts.current_balance IS 'Current account balance or asset value';
COMMENT ON COLUMN user_chart_of_accounts.available_balance IS 'Available balance (checking accounts)';
COMMENT ON COLUMN user_chart_of_accounts.statement_balance IS 'Statement balance (credit cards)';
COMMENT ON COLUMN user_chart_of_accounts.include_in_net_worth IS 'Whether to include this account in net worth calculations';
COMMENT ON COLUMN user_chart_of_accounts.display_in_sidebar IS 'Whether to show this account in sidebar navigation';
