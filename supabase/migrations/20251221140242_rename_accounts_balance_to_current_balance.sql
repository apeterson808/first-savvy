/*
  # Rename accounts.balance to accounts.current_balance

  ## Overview
  This migration standardizes the balance column name in the accounts table to match
  the naming convention used across all other balance-tracking tables (liabilities, equity)
  and the application frontend code.

  ## Changes

  ### 1. Rename Column
  - Rename `balance` → `current_balance` in accounts table
  - This aligns with the column name expected by the frontend code
  - Matches naming convention in liabilities and equity tables

  ### 2. Impact
  - Fixes PGRST204 errors when creating/updating accounts from the frontend
  - All existing data is preserved during the rename
  - No changes needed to RLS policies (they don't reference column names directly)
*/

-- Step 1: Rename the balance column to current_balance
ALTER TABLE accounts
  RENAME COLUMN balance TO current_balance;

-- Note: The available_balance column already exists and doesn't need changes
-- Note: No index changes needed (indexes reference column position, not name)
-- Note: No RLS policy changes needed (policies don't reference column names directly)
