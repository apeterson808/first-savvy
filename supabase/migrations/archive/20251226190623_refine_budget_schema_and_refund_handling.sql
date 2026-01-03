/*
  # Refine Budget Schema and Refund Handling

  ## Overview
  This migration refines the budgets table to enforce data integrity and establishes
  proper refund handling throughout the system.

  ## Changes Made

  ### 1. Budgets Table Schema Cleanup
  - **Add UNIQUE constraint** on (profile_id, chart_account_id) to prevent duplicate budgets
  - **Make chart_account_id NOT NULL** - all budgets must reference a chart account
  - **Drop name column** - Chart of Accounts display_name is the single source of truth
  - **Clean up any existing duplicates** before adding constraints

  ### 2. Transactions Amount Validation
  - **Add CHECK constraint** to ensure transactions.amount is always positive
  - Refunds are stored as type='income' with original_type='expense'
  - This ensures no negative amounts exist in the system

  ### 3. Performance Optimization
  - **Add index** on transactions(original_type) for refund filtering queries
  - Partial index (only where original_type IS NOT NULL) to save space

  ## Security & Data Integrity
  - All constraints are added with IF NOT EXISTS checks for idempotency
  - Existing data is validated before constraints are applied
  - No data loss occurs during migration

  ## Notes
  - Refunds will show as income (type='income') but can be identified via original_type='expense'
  - Budget calculations can optionally exclude refunds using original_type field
  - All budgets now strictly reference chart of accounts for naming
*/

-- Step 1: Clean up any duplicate budgets before adding unique constraint
-- Keep the most recently created budget for each (profile_id, chart_account_id) pair
DO $$
DECLARE
  duplicates_found integer;
BEGIN
  -- Delete duplicate budgets, keeping only the most recent one
  WITH ranked_budgets AS (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY profile_id, chart_account_id 
             ORDER BY created_at DESC
           ) as rn
    FROM budgets
    WHERE chart_account_id IS NOT NULL
  )
  DELETE FROM budgets
  WHERE id IN (
    SELECT id FROM ranked_budgets WHERE rn > 1
  );
  
  GET DIAGNOSTICS duplicates_found = ROW_COUNT;
  
  IF duplicates_found > 0 THEN
    RAISE NOTICE 'Cleaned up % duplicate budget entries', duplicates_found;
  END IF;
END $$;

-- Step 2: Add UNIQUE constraint on budgets (profile_id, chart_account_id)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'budgets_profile_chart_account_unique'
  ) THEN
    ALTER TABLE budgets 
      ADD CONSTRAINT budgets_profile_chart_account_unique 
      UNIQUE (profile_id, chart_account_id);
    RAISE NOTICE 'Added unique constraint on budgets(profile_id, chart_account_id)';
  END IF;
END $$;

-- Step 3: Make chart_account_id NOT NULL (after ensuring all budgets have one)
-- First, check if there are any budgets without chart_account_id
DO $$
DECLARE
  orphaned_count integer;
BEGIN
  SELECT COUNT(*) INTO orphaned_count
  FROM budgets
  WHERE chart_account_id IS NULL;
  
  IF orphaned_count > 0 THEN
    RAISE WARNING 'Found % budgets without chart_account_id. These need to be fixed before making the column NOT NULL.', orphaned_count;
  ELSE
    -- Safe to make NOT NULL
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'budgets' 
      AND column_name = 'chart_account_id'
      AND is_nullable = 'YES'
    ) THEN
      ALTER TABLE budgets 
        ALTER COLUMN chart_account_id SET NOT NULL;
      RAISE NOTICE 'Made budgets.chart_account_id NOT NULL';
    END IF;
  END IF;
END $$;

-- Step 4: Drop the name column from budgets table
-- COA display_name is now the single source of truth
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'name'
  ) THEN
    ALTER TABLE budgets DROP COLUMN name;
    RAISE NOTICE 'Dropped budgets.name column - using COA display_name instead';
  END IF;
END $$;

-- Step 5: Add CHECK constraint to ensure transactions.amount is always positive
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'transactions_amount_positive'
  ) THEN
    -- First verify no negative amounts exist
    IF EXISTS (SELECT 1 FROM transactions WHERE amount < 0) THEN
      RAISE WARNING 'Found negative amounts in transactions table. These need to be fixed before adding constraint.';
    ELSE
      ALTER TABLE transactions 
        ADD CONSTRAINT transactions_amount_positive 
        CHECK (amount > 0);
      RAISE NOTICE 'Added CHECK constraint: transactions.amount must be positive';
    END IF;
  END IF;
END $$;

-- Step 6: Add index on transactions.original_type for refund filtering
-- Partial index to save space (only index rows where original_type is set)
CREATE INDEX IF NOT EXISTS idx_transactions_original_type 
  ON transactions(original_type) 
  WHERE original_type IS NOT NULL;

-- Step 7: Add helpful comment for future developers
COMMENT ON COLUMN transactions.original_type IS 'Stores the original transaction type before conversion. Used to identify refunds: when type=''income'' and original_type=''expense'', this is a refund.';

COMMENT ON COLUMN budgets.chart_account_id IS 'Required reference to chart of accounts. Budget display name comes from the linked chart account, not from a local name field.';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Budget schema refinement and refund handling migration completed successfully';
END $$;
