/*
  # Add Bank Balance and Sync Tracking to Accounts

  ## Overview
  Adds fields to track bank-reported balance separately from Savvy (book) balance,
  enabling QuickBooks-style dual balance display and reconciliation workflow.

  ## New Fields to user_chart_of_accounts table
  
  1. `bank_balance` (numeric)
     - Last balance reported by the bank/credit card company
     - Updated when syncing with Plaid or importing statements
     - NULL if never synced
  
  2. `last_synced_at` (timestamptz)
     - Timestamp of last successful sync with bank
     - NULL if never synced
  
  3. `last_statement_date` (date)
     - Date of the last statement import
     - Used for reconciliation
  
  ## Balance Types Explained
  - **current_balance (Savvy Balance)**: Calculated from journal entries, your accounting truth
  - **bank_balance (Bank Balance)**: What the bank reports, may include uncleared items
  - **available_balance**: Available to spend (existing field, may differ from both)
  - **statement_balance**: Balance from last statement for reconciliation (existing field)

  ## Use Cases
  - Show both balances in account list with visual indicator when they differ
  - Reconciliation: match Savvy Balance to Bank Balance
  - Track sync freshness with last_synced_at
  - Historical comparison of book vs bank balances
*/

-- Add bank_balance column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_chart_of_accounts' AND column_name = 'bank_balance'
  ) THEN
    ALTER TABLE user_chart_of_accounts 
    ADD COLUMN bank_balance numeric(15,2);
  END IF;
END $$;

-- Add last_synced_at column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_chart_of_accounts' AND column_name = 'last_synced_at'
  ) THEN
    ALTER TABLE user_chart_of_accounts 
    ADD COLUMN last_synced_at timestamptz;
  END IF;
END $$;

-- Add last_statement_date column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_chart_of_accounts' AND column_name = 'last_statement_date'
  ) THEN
    ALTER TABLE user_chart_of_accounts 
    ADD COLUMN last_statement_date date;
  END IF;
END $$;

-- Add index for quickly finding accounts that need reconciliation (using profile_id)
CREATE INDEX IF NOT EXISTS idx_accounts_needs_reconciliation 
  ON user_chart_of_accounts(profile_id) 
  WHERE bank_balance IS NOT NULL 
    AND ABS(COALESCE(current_balance, 0) - COALESCE(bank_balance, 0)) > 0.01;

-- Add comments to document the fields
COMMENT ON COLUMN user_chart_of_accounts.bank_balance IS 
'Balance reported by bank/financial institution. NULL if never synced. Compare with current_balance (Savvy Balance) for reconciliation.';

COMMENT ON COLUMN user_chart_of_accounts.last_synced_at IS 
'Timestamp of last successful sync with bank via Plaid or statement import. NULL if never synced.';

COMMENT ON COLUMN user_chart_of_accounts.last_statement_date IS 
'Date of the most recent statement import. Used for reconciliation and statement matching.';