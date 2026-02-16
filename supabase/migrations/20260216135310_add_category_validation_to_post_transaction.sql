/*
  # Add Category Validation to Post Transaction

  1. Changes
    - Update rpc_post_transaction function to validate category presence
    - Transactions must have a category before posting (except transfers and credit card payments)
    - Split transactions are validated separately (must have splits)
  
  2. Validation Rules
    - Regular transactions: must have category_account_id
    - Transfer transactions (type = 'transfer' or has transfer_pair_id): exempt from category requirement
    - Credit card payments (type = 'credit_card_payment' or has cc_payment_pair_id): exempt from category requirement
    - Split transactions (is_split = true): must have splits (validated separately)
  
  3. Security
    - Prevents posting transactions without proper categorization
    - Ensures data integrity at the database level
    - Provides clear error messages for validation failures
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS rpc_post_transaction(uuid);

-- Recreate with validation
CREATE OR REPLACE FUNCTION rpc_post_transaction(p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_result jsonb;
  v_transaction_record RECORD;
BEGIN
  -- Get the transaction first to check its properties
  SELECT * INTO v_transaction_record
  FROM transactions
  WHERE id = p_transaction_id;

  -- Check if transaction was found
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
  END IF;

  -- Validate category requirement
  -- Exempt: transfers, credit card payments
  -- Required: regular transactions (unless they are splits)
  IF v_transaction_record.type NOT IN ('transfer', 'credit_card_payment')
     AND v_transaction_record.transfer_pair_id IS NULL
     AND v_transaction_record.cc_payment_pair_id IS NULL
     AND v_transaction_record.is_split = false
     AND v_transaction_record.category_account_id IS NULL THEN
    RAISE EXCEPTION 'Cannot post transaction: category is required';
  END IF;

  -- Set the session flag within this transaction
  PERFORM set_config('app.internal_status_write', 'true', true);

  -- Update the transaction status
  UPDATE transactions
  SET status = 'posted'
  WHERE id = p_transaction_id
  RETURNING * INTO v_transaction_record;

  -- Convert record to jsonb
  v_result := to_jsonb(v_transaction_record);

  -- Clear the flag (though it will be cleared at end of transaction anyway)
  PERFORM set_config('app.internal_status_write', 'false', true);

  RETURN v_result;
END;
$$;