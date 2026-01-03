/*
  # Add Balance Columns to Statement Cache

  1. Changes
    - Add `beginning_balance` column to store the starting balance from the statement
    - Add `ending_balance` column to store the closing balance from the statement
    - Add `balance_metadata` jsonb column for additional balance-related information
    - These fields enable automatic opening balance calculation during import

  2. Notes
    - Columns are nullable since not all statements may have balance information
    - Balance metadata can store things like available credit, credit limit, etc.
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'statement_cache' AND column_name = 'beginning_balance'
  ) THEN
    ALTER TABLE statement_cache ADD COLUMN beginning_balance numeric(15, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'statement_cache' AND column_name = 'ending_balance'
  ) THEN
    ALTER TABLE statement_cache ADD COLUMN ending_balance numeric(15, 2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'statement_cache' AND column_name = 'balance_metadata'
  ) THEN
    ALTER TABLE statement_cache ADD COLUMN balance_metadata jsonb DEFAULT '{}'::jsonb;
  END IF;
END $$;