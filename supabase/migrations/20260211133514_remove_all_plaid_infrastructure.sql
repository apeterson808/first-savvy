/*
  # Remove All Plaid Infrastructure

  1. Columns Removed
    - `transactions.plaid_transaction_id`
    - `user_chart_of_accounts.plaid_account_id`
    - `user_chart_of_accounts.plaid_item_id`

  2. Tables Removed
    - `plaid_items` (including all RLS policies, indexes, and foreign keys)

  3. Constraints and Indexes Removed
    - `transactions_plaid_transaction_id_key` (unique constraint)
    - `idx_transactions_plaid_transaction_id_unique`
    - `idx_user_chart_of_accounts_plaid_item_id_fkey`
    - `user_chart_of_accounts_plaid_item_id_fkey` (foreign key)

  4. Security Changes
    - Removed 4 RLS policies from plaid_items table

  5. Notes
    - All plaid-related data was confirmed empty (0 rows) before removal
    - This completes the full removal of Plaid integration from the database
*/

ALTER TABLE IF EXISTS user_chart_of_accounts
  DROP CONSTRAINT IF EXISTS user_chart_of_accounts_plaid_item_id_fkey;

ALTER TABLE IF EXISTS transactions
  DROP CONSTRAINT IF EXISTS transactions_plaid_transaction_id_key;

DROP INDEX IF EXISTS idx_transactions_plaid_transaction_id_unique;
DROP INDEX IF EXISTS idx_user_chart_of_accounts_plaid_item_id_fkey;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_chart_of_accounts' AND column_name = 'plaid_item_id'
  ) THEN
    ALTER TABLE user_chart_of_accounts DROP COLUMN plaid_item_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_chart_of_accounts' AND column_name = 'plaid_account_id'
  ) THEN
    ALTER TABLE user_chart_of_accounts DROP COLUMN plaid_account_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'plaid_transaction_id'
  ) THEN
    ALTER TABLE transactions DROP COLUMN plaid_transaction_id;
  END IF;
END $$;

DROP TABLE IF EXISTS plaid_items CASCADE;
