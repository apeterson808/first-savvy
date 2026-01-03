/*
  # Add Plaid Integration Columns to Credit Cards

  1. New Columns
    - `plaid_account_id` (text, unique) - Plaid unique account identifier
    - `plaid_item_id` (text) - Plaid item ID linking to institution connection

  2. Purpose
    - Enable credit card accounts to be linked with Plaid for automatic syncing
    - Support the same Plaid integration pattern used in the accounts table
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_cards' AND column_name = 'plaid_account_id'
  ) THEN
    ALTER TABLE credit_cards ADD COLUMN plaid_account_id text UNIQUE;
    COMMENT ON COLUMN credit_cards.plaid_account_id IS 'Plaid unique account identifier';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_cards' AND column_name = 'plaid_item_id'
  ) THEN
    ALTER TABLE credit_cards ADD COLUMN plaid_item_id text;
    COMMENT ON COLUMN credit_cards.plaid_item_id IS 'Plaid item ID linking account to institution connection';
  END IF;
END $$;
