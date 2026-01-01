/*
  # Add Excluded Status to Transactions

  1. Changes
    - Update status column CHECK constraint to allow 'pending', 'posted', or 'excluded'
    - Allows transactions to be excluded from reports and budget calculations
    
  2. Purpose
    - Enable users to exclude transactions (e.g., duplicates, test data, erroneous entries)
    - Excluded transactions are not counted in budgets or reports
    
  3. Notes
    - Drops the existing constraint and creates a new one with all three status values
*/

-- Drop the existing constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage 
    WHERE table_name = 'transactions' 
    AND constraint_name LIKE '%status%check%'
  ) THEN
    ALTER TABLE transactions 
    DROP CONSTRAINT IF EXISTS transactions_status_check;
  END IF;
END $$;

-- Add new constraint with 'excluded' as a valid status
ALTER TABLE transactions 
ADD CONSTRAINT transactions_status_check 
CHECK (status IN ('pending', 'posted', 'excluded'));