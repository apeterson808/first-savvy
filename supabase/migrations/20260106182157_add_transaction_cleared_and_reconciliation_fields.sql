/*
  # Add Transaction Clearing and Reconciliation Support

  ## Overview
  Adds fields to support QuickBooks-style reconciliation workflow where transactions
  can be marked as cleared when they appear on bank statements, enabling proper
  tracking of bank balance vs savvy (book) balance.

  ## New Fields to transactions table
  
  1. `cleared_status` (text)
     - 'uncleared': Transaction not yet on bank statement
     - 'cleared': Appears on bank statement but not reconciled
     - 'reconciled': Confirmed during formal reconciliation process
     - Default: 'uncleared'
  
  2. `cleared_date` (date, nullable)
     - Date the transaction was marked as cleared
     - Usually matches the date it appeared on the bank statement
  
  3. `reconciliation_id` (uuid, nullable)
     - Links to a future reconciliation record
     - Groups transactions into reconciliation sessions
  
  ## Balance Calculation Impact
  - **Savvy Balance**: All posted transactions with journal entries (what you've categorized)
  - **Bank Balance**: All cleared + reconciled transactions (what the bank reports)
  - **Difference**: Uncleared transactions (in transit, pending, or not yet on statement)

  ## Indexes
  - Add index on cleared_status for quick filtering
  - Add composite index on bank_account_id + cleared_status for reconciliation views
*/

-- Add cleared_status column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'cleared_status'
  ) THEN
    ALTER TABLE transactions 
    ADD COLUMN cleared_status text DEFAULT 'uncleared' 
    CHECK (cleared_status IN ('uncleared', 'cleared', 'reconciled'));
  END IF;
END $$;

-- Add cleared_date column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'cleared_date'
  ) THEN
    ALTER TABLE transactions ADD COLUMN cleared_date date;
  END IF;
END $$;

-- Add reconciliation_id column
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'reconciliation_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN reconciliation_id uuid;
  END IF;
END $$;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_cleared_status 
  ON transactions(cleared_status);

CREATE INDEX IF NOT EXISTS idx_transactions_account_cleared 
  ON transactions(bank_account_id, cleared_status);

CREATE INDEX IF NOT EXISTS idx_transactions_reconciliation 
  ON transactions(reconciliation_id) 
  WHERE reconciliation_id IS NOT NULL;

-- Add comments to document the fields
COMMENT ON COLUMN transactions.cleared_status IS 
'Clearing status for reconciliation: uncleared (not on statement), cleared (on statement), reconciled (confirmed in reconciliation session)';

COMMENT ON COLUMN transactions.cleared_date IS 
'Date the transaction was marked as cleared, typically when it appeared on bank statement';

COMMENT ON COLUMN transactions.reconciliation_id IS 
'Links to reconciliation session where this transaction was formally reconciled';