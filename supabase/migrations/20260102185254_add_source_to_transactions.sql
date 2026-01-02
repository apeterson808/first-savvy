/*
  # Add Source Field to Transactions

  1. Changes
    - Add `source` column to `transactions` table
    - Values: 'manual', 'csv', 'ofx', 'pdf', 'api'
    - Default to 'manual' for existing transactions
    - Add `statement_upload_id` to link transactions to their upload record

  2. Purpose
    - Track how each transaction was imported
    - Enable filtering by import source
    - Link transactions back to statement upload for auditing
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'source'
  ) THEN
    ALTER TABLE transactions ADD COLUMN source text DEFAULT 'manual' CHECK (source IN ('manual', 'csv', 'ofx', 'pdf', 'api'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'statement_upload_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN statement_upload_id uuid REFERENCES statement_uploads(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_source ON transactions(source);
CREATE INDEX IF NOT EXISTS idx_transactions_statement_upload_id ON transactions(statement_upload_id);