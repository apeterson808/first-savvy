/*
  # Fix Income Transaction Posting on Credit Cards

  1. Changes
    - Update rpc_post_transaction to exempt income transactions on credit card accounts from category requirement
    - Credit card payments (positive amounts on credit cards) are often imported as type='income' but don't need categorization
    - They represent liability reductions, not true income

  2. Logic
    - Check if transaction is on a credit card account (liability class)
    - If type='income' AND bank account is liability (credit card), exempt from category requirement
    - This allows credit card payments to be posted without requiring a category

  3. Security
    - Maintains validation for all other transaction types
    - Only affects income transactions on liability accounts
*/

DROP FUNCTION IF EXISTS rpc_post_transaction(uuid);

CREATE OR REPLACE FUNCTION rpc_post_transaction(p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_result jsonb;
  v_transaction_record RECORD;
  v_bank_account_class text;
BEGIN
  -- Get the transaction first to check its properties
  SELECT * INTO v_transaction_record
  FROM transactions
  WHERE id = p_transaction_id;

  -- Check if transaction was found
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
  END IF;

  -- Get bank account class to check if it's a credit card
  SELECT class INTO v_bank_account_class
  FROM user_chart_of_accounts
  WHERE id = v_transaction_record.bank_account_id;

  -- Validate category requirement
  -- Exempt: 
  --   1. transfers (is_transfer_pair = true or paired_transfer_id is set)
  --   2. explicit credit_card_payment type
  --   3. income transactions on credit card accounts (liability class) - these are payments
  -- Required: regular transactions (unless they are splits)
  IF v_transaction_record.type NOT IN ('transfer', 'credit_card_payment')
     AND v_transaction_record.paired_transfer_id IS NULL
     AND COALESCE(v_transaction_record.is_transfer_pair, false) = false
     AND v_transaction_record.is_split = false
     AND v_transaction_record.category_account_id IS NULL
     AND NOT (v_transaction_record.type = 'income' AND v_bank_account_class = 'liability') THEN
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
