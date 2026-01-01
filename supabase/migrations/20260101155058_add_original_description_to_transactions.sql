/*
  # Add Original Description Column to Transactions

  ## Overview
  Adds `original_description` column to store the unmodified bank statement description
  for each transaction. This enables accurate matching of recurring transactions based on
  how the bank consistently describes them, rather than user-modified descriptions.

  ## Schema Changes

  ### Transactions Table
  - Add `original_description` (text, nullable) - The original bank statement description
    - Nullable because existing transactions and manually-entered transactions won't have this
    - Used for matching recurring transactions from the same source
    - Should be populated on import and never modified by users

  ## Indexes
  - Add index on `original_description` for fast searching and matching operations
  - Use text_pattern_ops for case-insensitive partial matching performance

  ## Important Notes
  1. This field should be set once during import and never changed
  2. The `description` field can be edited by users, but `original_description` stays constant
  3. This enables finding all transactions from the same payee/merchant regardless of user edits
  4. Used by contact matching and categorization rule systems
*/

-- Add original_description column to transactions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'original_description'
  ) THEN
    ALTER TABLE transactions ADD COLUMN original_description text;
    COMMENT ON COLUMN transactions.original_description IS 'Unmodified bank statement description for matching recurring transactions';
  END IF;
END $$;

-- Create index for fast searching on original_description
CREATE INDEX IF NOT EXISTS idx_transactions_original_description 
  ON transactions(original_description);

-- Create additional index for case-insensitive pattern matching
CREATE INDEX IF NOT EXISTS idx_transactions_original_description_lower 
  ON transactions(LOWER(original_description) text_pattern_ops);