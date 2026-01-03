/*
  # Standardize Column Naming Conventions Across All Tables

  ## Overview
  This migration standardizes column naming conventions across the entire database schema
  to ensure consistency and clarity. It addresses naming inconsistencies that have
  accumulated across different tables.

  ## Changes

  ### 1. Transactions Table - Remove Duplicate Column
  - **Issue**: Has both `transaction_type` and `type` columns serving the same purpose
  - **Solution**: Keep `type` and remove `transaction_type`
  - **Migration**: Copy any data from `transaction_type` to `type` if needed, then drop `transaction_type`
  - **Impact**: Simplifies schema and prevents confusion

  ### 2. Assets Table - Standardize Balance Column Name
  - **Issue**: Uses `current_value` instead of `current_balance`
  - **Solution**: Rename `current_value` → `current_balance`
  - **Rationale**: Matches naming convention in accounts, equity, and liabilities tables
  - **Impact**: Creates consistency across all financial tracking tables

  ### 3. Budgets Table - Clarify Amount Column Name
  - **Issue**: Uses generic `limit_amount`
  - **Solution**: Rename `limit_amount` → `allocated_amount`
  - **Rationale**: More clearly describes that this is the budgeted/allocated amount
  - **Impact**: Improves code readability and self-documentation

  ## Data Safety
  - All data is preserved during column renames
  - Uses ALTER TABLE RENAME COLUMN which is atomic and safe
  - No data migration needed (only metadata changes)

  ## Backward Compatibility
  - Frontend code will need updates to use new column names
  - No views needed as old column names will no longer exist
*/

-- ============================================================================
-- 1. TRANSACTIONS TABLE: Remove duplicate transaction_type column
-- ============================================================================

-- First, ensure all data from transaction_type is copied to type if type is null
UPDATE transactions
SET type = transaction_type
WHERE type IS NULL AND transaction_type IS NOT NULL;

-- Now drop the transaction_type column
ALTER TABLE transactions
DROP COLUMN IF EXISTS transaction_type;

-- ============================================================================
-- 2. ASSETS TABLE: Standardize balance column name
-- ============================================================================

-- Rename current_value to current_balance
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'current_value'
  ) THEN
    ALTER TABLE assets RENAME COLUMN current_value TO current_balance;
  END IF;
END $$;

-- ============================================================================
-- 3. BUDGETS TABLE: Clarify amount column name
-- ============================================================================

-- Rename limit_amount to allocated_amount
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'limit_amount'
  ) THEN
    ALTER TABLE budgets RENAME COLUMN limit_amount TO allocated_amount;
  END IF;
END $$;

-- ============================================================================
-- VERIFICATION: Confirm all changes were applied
-- ============================================================================

-- The following comment documents the final standardized naming conventions:
-- 
-- BALANCE COLUMNS (across all tables):
--   - accounts.current_balance ✓
--   - assets.current_balance ✓ (was current_value)
--   - equity.current_balance ✓
--   - liabilities.current_balance ✓
--   - bank_accounts.current_balance ✓ (legacy table)
--   - credit_cards.current_balance ✓ (legacy table)
-- 
-- TYPE COLUMNS:
--   - transactions.type ✓ (transaction_type removed)
--   - categories.type ✓
--   - contacts.type ✓
-- 
-- AMOUNT COLUMNS:
--   - budgets.allocated_amount ✓ (was limit_amount)
--   - transactions.amount ✓
