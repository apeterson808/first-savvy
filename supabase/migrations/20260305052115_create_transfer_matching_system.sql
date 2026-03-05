/*
  # Create Transfer Matching System

  1. Schema Changes
    - Add `paired_transfer_id` column to transactions table (uuid, nullable, foreign key)
    - Add `is_transfer_pair` column to transactions table (boolean, default false)
    - Add index on paired_transfer_id for performance
    - Add trigger to ensure bidirectional pairing consistency

  2. Functions
    - `find_opposite_amount_matches`: Find matching transfer transactions with opposite amounts
      - Takes transaction_id as input
      - Returns up to 10 matching transactions sorted by date proximity
      - Filters for opposite amount, different account, same profile, within 7 days
    - `validate_transfer_pairing`: Trigger function to ensure proper bidirectional pairing

  3. Security
    - RLS policies already exist for transactions table
    - Function uses SECURITY INVOKER to respect RLS policies
*/

-- Add new columns to transactions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'paired_transfer_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN paired_transfer_id uuid REFERENCES transactions(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'is_transfer_pair'
  ) THEN
    ALTER TABLE transactions ADD COLUMN is_transfer_pair boolean DEFAULT false;
  END IF;
END $$;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_transactions_paired_transfer_id ON transactions(paired_transfer_id);

-- Create function to validate transfer pairing
CREATE OR REPLACE FUNCTION validate_transfer_pairing()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
BEGIN
  -- If paired_transfer_id is set, verify the pairing is bidirectional
  IF NEW.paired_transfer_id IS NOT NULL THEN
    -- Check if the paired transaction exists and points back to this one
    IF NOT EXISTS (
      SELECT 1 FROM transactions 
      WHERE id = NEW.paired_transfer_id 
      AND (paired_transfer_id = NEW.id OR paired_transfer_id IS NULL)
    ) THEN
      RAISE EXCEPTION 'Invalid transfer pairing: paired transaction must exist and allow bidirectional link';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for pairing validation
DROP TRIGGER IF EXISTS validate_transfer_pairing_trigger ON transactions;
CREATE TRIGGER validate_transfer_pairing_trigger
  BEFORE INSERT OR UPDATE OF paired_transfer_id
  ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION validate_transfer_pairing();

-- Create function to find opposite amount matches
CREATE OR REPLACE FUNCTION find_opposite_amount_matches(
  p_transaction_id uuid
)
RETURNS TABLE (
  id uuid,
  date date,
  description text,
  amount numeric,
  type text,
  bank_account_id uuid,
  category_account_id uuid,
  contact_id uuid,
  status text,
  date_diff integer
)
SECURITY INVOKER
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction record;
BEGIN
  -- Get the source transaction details
  SELECT t.amount, t.bank_account_id, t.profile_id, t.date, t.paired_transfer_id
  INTO v_transaction
  FROM transactions t
  WHERE t.id = p_transaction_id;

  -- Return empty if transaction not found or already paired
  IF NOT FOUND OR v_transaction.paired_transfer_id IS NOT NULL THEN
    RETURN;
  END IF;

  -- Find matching transactions
  RETURN QUERY
  SELECT 
    t.id,
    t.date,
    t.description,
    t.amount,
    t.type,
    t.bank_account_id,
    t.category_account_id,
    t.contact_id,
    t.status,
    ABS(t.date - v_transaction.date) as date_diff
  FROM transactions t
  WHERE 
    t.id != p_transaction_id
    AND t.amount = -1 * v_transaction.amount  -- Opposite amount
    AND t.bank_account_id != v_transaction.bank_account_id  -- Different account
    AND t.profile_id = v_transaction.profile_id  -- Same profile
    AND t.status = 'pending'  -- Only pending transactions
    AND t.type = 'transfer'  -- Only transfers
    AND ABS(t.date - v_transaction.date) <= 7  -- Within 7 days
    AND t.paired_transfer_id IS NULL  -- Not already paired
  ORDER BY date_diff ASC, t.date DESC
  LIMIT 10;
END;
$$;