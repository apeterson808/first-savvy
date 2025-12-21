/*
  # Remove Plaid Integration

  This migration removes all Plaid-related database objects and columns.

  ## Changes

  1. **Drop Columns**
     - Remove `plaid_account_id` from `accounts` table
     - Remove `plaid_item_id` from `accounts` table
     - Remove `plaid_account_id` from `credit_cards` table
     - Remove `plaid_item_id` from `credit_cards` table
     - Remove `plaid_transaction_id` from `transactions` table

  2. **Drop Tables**
     - Drop `plaid_items` table completely

  3. **Drop Indexes**
     - Drop all Plaid-related indexes

  ## Notes
  - All existing account and transaction data will be preserved
  - Only Plaid connection metadata will be removed
  - Uses IF EXISTS to prevent errors if objects don't exist
*/

-- Drop indexes first (if they exist)
DROP INDEX IF EXISTS idx_accounts_plaid_account_id;
DROP INDEX IF EXISTS idx_accounts_plaid_item_id;
DROP INDEX IF EXISTS idx_credit_cards_plaid_account_id;
DROP INDEX IF EXISTS idx_credit_cards_plaid_item_id;
DROP INDEX IF EXISTS idx_transactions_plaid_transaction_id;
DROP INDEX IF EXISTS idx_plaid_items_user_id;

-- Drop columns from accounts table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'plaid_account_id'
  ) THEN
    ALTER TABLE accounts DROP COLUMN plaid_account_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'plaid_item_id'
  ) THEN
    ALTER TABLE accounts DROP COLUMN plaid_item_id;
  END IF;
END $$;

-- Drop columns from credit_cards table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_cards' AND column_name = 'plaid_account_id'
  ) THEN
    ALTER TABLE credit_cards DROP COLUMN plaid_account_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_cards' AND column_name = 'plaid_item_id'
  ) THEN
    ALTER TABLE credit_cards DROP COLUMN plaid_item_id;
  END IF;
END $$;

-- Drop column from transactions table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'plaid_transaction_id'
  ) THEN
    ALTER TABLE transactions DROP COLUMN plaid_transaction_id;
  END IF;
END $$;

-- Drop plaid_items table
DROP TABLE IF EXISTS plaid_items CASCADE;