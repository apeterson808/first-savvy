/*
  # Add Unique Index on plaid_transaction_id

  1. Modified Tables
    - `transactions`
      - Added unique index on `plaid_transaction_id` (where not null)
      - This enables upsert behavior during Plaid transaction sync to prevent duplicates

  2. Important Notes
    - Uses a partial unique index (WHERE plaid_transaction_id IS NOT NULL) so that
      manually-entered transactions without a Plaid ID are unaffected
    - Required for the sync-transactions edge function's upsert on conflict behavior
*/

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_plaid_transaction_id_unique
  ON transactions (plaid_transaction_id)
  WHERE plaid_transaction_id IS NOT NULL;
