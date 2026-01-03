/*
  # Remove obsolete sync trigger and add account_id column

  1. Changes
    - Drop obsolete `sync_transaction_fields` trigger and function (references deleted columns)
    - Add `account_id` column to `transactions` table
    - Populate existing transactions with account assignments
  
  2. Notes
    - The old trigger referenced bank_account_id and credit_card_id which no longer exist
    - Transactions will be distributed across available bank accounts
*/

-- Drop the obsolete trigger and function
DROP TRIGGER IF EXISTS sync_transaction_fields_trigger ON transactions;
DROP FUNCTION IF EXISTS sync_transaction_fields();

-- Add account_id column to link transactions to bank accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE transactions 
    ADD COLUMN account_id uuid REFERENCES user_chart_of_accounts(id);
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);

-- Distribute existing transactions across the 4 bank accounts
DO $$
DECLARE
  profile_id_val uuid := '761b9597-16b7-454d-9a64-861b60cffe13';
  checking_id uuid;
  chase_checking_id uuid;
  savings_id uuid;
  chase_savings_id uuid;
  transaction_ids uuid[];
  chunk_size int;
BEGIN
  -- Get the bank account IDs
  SELECT id INTO checking_id FROM user_chart_of_accounts 
  WHERE profile_id = profile_id_val AND display_name = 'Checking' AND account_type = 'bank_accounts' LIMIT 1;
  
  SELECT id INTO chase_checking_id FROM user_chart_of_accounts 
  WHERE profile_id = profile_id_val AND display_name = 'Chase Freedom Checking' AND account_type = 'bank_accounts' LIMIT 1;
  
  SELECT id INTO savings_id FROM user_chart_of_accounts 
  WHERE profile_id = profile_id_val AND display_name = 'Savings' AND account_type = 'bank_accounts' LIMIT 1;
  
  SELECT id INTO chase_savings_id FROM user_chart_of_accounts 
  WHERE profile_id = profile_id_val AND display_name = 'Chase Savings' AND account_type = 'bank_accounts' LIMIT 1;

  -- Get all transaction IDs that don't have an account_id yet
  SELECT array_agg(id ORDER BY date DESC) INTO transaction_ids
  FROM transactions
  WHERE profile_id = profile_id_val AND account_id IS NULL;

  IF transaction_ids IS NOT NULL AND array_length(transaction_ids, 1) > 0 THEN
    -- Calculate chunk size (divide transactions equally among 4 accounts)
    chunk_size := array_length(transaction_ids, 1) / 4;

    -- Assign to Checking (first 25%)
    IF checking_id IS NOT NULL THEN
      UPDATE transactions
      SET account_id = checking_id
      WHERE id = ANY(transaction_ids[1:GREATEST(chunk_size, 1)]);
    END IF;

    -- Assign to Chase Checking (next 25%)
    IF chase_checking_id IS NOT NULL THEN
      UPDATE transactions
      SET account_id = chase_checking_id
      WHERE id = ANY(transaction_ids[GREATEST(chunk_size+1, 1):GREATEST(chunk_size*2, 1)]);
    END IF;

    -- Assign to Savings (next 25%)
    IF savings_id IS NOT NULL THEN
      UPDATE transactions
      SET account_id = savings_id
      WHERE id = ANY(transaction_ids[GREATEST(chunk_size*2+1, 1):GREATEST(chunk_size*3, 1)]);
    END IF;

    -- Assign rest to Chase Savings
    IF chase_savings_id IS NOT NULL THEN
      UPDATE transactions
      SET account_id = chase_savings_id
      WHERE id = ANY(transaction_ids[GREATEST(chunk_size*3+1, 1):array_length(transaction_ids, 1)]);
    END IF;
  END IF;

END $$;
