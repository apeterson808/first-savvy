/*
  # Add Transactions Cursor for Plaid Sync

  1. Changes
    - Add `transactions_cursor` text column to store Plaid's sync cursor
    - This enables incremental transaction syncing using Plaid's /transactions/sync endpoint

  2. Purpose
    - Support webhook-driven transaction syncing
    - Enable efficient incremental updates instead of full re-imports
*/

-- Add transactions_cursor column for sync support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plaid_items' AND column_name = 'transactions_cursor'
  ) THEN
    ALTER TABLE plaid_items ADD COLUMN transactions_cursor text;
  END IF;
END $$;
