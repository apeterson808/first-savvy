/*
  # Add Transaction Status and Reporting Flag

  1. Changes
    - Add `status` column to transactions table with values 'pending' or 'posted'
    - Add `include_in_reports` boolean flag (true only when posted)
    - Set default status to 'pending' for new transactions
    - Backfill existing transactions as 'posted' and included in reports
    
  2. Purpose
    - Enable pending vs posted transaction workflow (industry standard)
    - Pending transactions can be categorized but don't affect budgets/reports
    - Posted transactions are final and count toward budget tracking
    
  3. Migration Strategy
    - All existing transactions treated as 'posted' with include_in_reports = true
    - New imports will default to 'pending' until confirmed/posted
    
  4. Notes
    - Matches QuickBooks, Monarch Money, and Mint workflows
    - Allows manual override of include_in_reports if needed
*/

-- Add status column with pending/posted values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'status'
  ) THEN
    ALTER TABLE transactions 
    ADD COLUMN status TEXT CHECK (status IN ('pending', 'posted')) DEFAULT 'pending';
  END IF;
END $$;

-- Add include_in_reports flag
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'include_in_reports'
  ) THEN
    ALTER TABLE transactions 
    ADD COLUMN include_in_reports BOOLEAN DEFAULT false;
  END IF;
END $$;

-- Backfill existing transactions as posted and included in reports
UPDATE transactions
SET 
  status = 'posted',
  include_in_reports = true
WHERE status IS NULL;

-- Create index for filtering by status (performance optimization)
CREATE INDEX IF NOT EXISTS idx_transactions_status 
ON transactions(status);

CREATE INDEX IF NOT EXISTS idx_transactions_include_in_reports 
ON transactions(include_in_reports) 
WHERE include_in_reports = true;

-- Create index for common query pattern: posted transactions in date range
CREATE INDEX IF NOT EXISTS idx_transactions_posted_date 
ON transactions(date, status, include_in_reports) 
WHERE status = 'posted' AND include_in_reports = true;
