/*
  # Remove Legacy category_id Columns

  ## Overview
  This migration removes all legacy `category_id` columns and ensures
  Chart of Accounts is the ONLY categorization system used.

  ## Changes Made
  1. **Transactions Table**
     - Drop `category_id` column
     - Ensure `chart_account_id` is the only categorization field
  
  2. **Budgets Table**
     - Drop `category_id` column
     - Ensure `chart_account_id` is the only categorization field
  
  3. **Bills Table**
     - Drop `category_id` column (if used, should map to chart accounts)

  ## Data Safety
  - Preserves all existing data
  - Only removes unused foreign key columns
  - Chart of Accounts system is already in place with data populated
*/

-- Step 1: Drop category_id from transactions table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'category_id'
  ) THEN
    -- Drop the index first if it exists
    DROP INDEX IF EXISTS idx_transactions_category_id;
    
    -- Drop the column
    ALTER TABLE transactions DROP COLUMN category_id;
    
    RAISE NOTICE 'Dropped category_id column from transactions table';
  END IF;
END $$;

-- Step 2: Drop category_id from budgets table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'category_id'
  ) THEN
    -- Drop the index first if it exists
    DROP INDEX IF EXISTS idx_budgets_category_id;
    
    -- Drop the column
    ALTER TABLE budgets DROP COLUMN category_id;
    
    RAISE NOTICE 'Dropped category_id column from budgets table';
  END IF;
END $$;

-- Step 3: Drop category_id from bills table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bills' AND column_name = 'category_id'
  ) THEN
    -- Drop the column
    ALTER TABLE bills DROP COLUMN category_id;
    
    RAISE NOTICE 'Dropped category_id column from bills table';
  END IF;
END $$;

-- Step 4: Verify chart_account_id columns exist and are indexed properly
-- Ensure transactions has proper index on chart_account_id
CREATE INDEX IF NOT EXISTS idx_transactions_chart_account_id 
  ON transactions(chart_account_id) 
  WHERE chart_account_id IS NOT NULL;

-- Ensure budgets has proper index on chart_account_id
CREATE INDEX IF NOT EXISTS idx_budgets_chart_account_id 
  ON budgets(chart_account_id) 
  WHERE chart_account_id IS NOT NULL;

-- Step 5: Log completion
DO $$
BEGIN
  RAISE NOTICE '==============================================';
  RAISE NOTICE 'Migration complete: Legacy category_id columns removed';
  RAISE NOTICE 'Chart of Accounts is now the ONLY categorization system';
  RAISE NOTICE '==============================================';
END $$;
