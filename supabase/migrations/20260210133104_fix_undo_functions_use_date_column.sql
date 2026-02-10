/*
  # Fix Undo Functions - Correct Date Column Reference

  ## Summary
  Fixes all three undo functions to use the correct column name `date` 
  instead of `transaction_date` which doesn't exist in the transactions table.

  ## Changes
  1. Update undo_post_transaction to use v_transaction.date
  2. Update undo_post_transfer_pair to use v_from_transaction.date
  3. Update undo_post_cc_payment_pair to use v_payment_transaction.date

  ## Impact
  Fixes error: record "v_transaction" has no field "transaction_date"
*/

-- Fix undo_post_transaction function
CREATE OR REPLACE FUNCTION undo_post_transaction(
  p_transaction_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
  v_transaction RECORD;
  v_original_entry_id UUID;
  v_reversal_entry_id UUID;
  v_entry_number TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT profile_id INTO v_profile_id
  FROM transactions
  WHERE id = p_transaction_id;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  SELECT * INTO v_transaction
  FROM transactions
  WHERE id = p_transaction_id;

  IF v_transaction.transaction_status != 'posted' THEN
    RAISE EXCEPTION 'Transaction must be posted to undo';
  END IF;

  v_original_entry_id := v_transaction.current_journal_entry_id;
  IF v_original_entry_id IS NULL THEN
    RAISE EXCEPTION 'No journal entry found for transaction';
  END IF;

  SELECT entry_number INTO v_entry_number
  FROM journal_entries
  WHERE id = v_original_entry_id;

  PERFORM set_session_flag('skip_journal_trigger', 'true');

  UPDATE transactions
  SET 
    transaction_status = 'pending',
    current_journal_entry_id = NULL
  WHERE id = p_transaction_id;

  v_reversal_entry_id := create_journal_entry(
    p_profile_id := v_profile_id,
    p_entry_type := 'adjustment',
    p_entry_date := v_transaction.date,
    p_description := 'Reversal of: ' || COALESCE(v_transaction.description, 'Transaction'),
    p_source := v_transaction.source,
    p_reverses_entry_id := v_original_entry_id,
    p_entry_number := v_entry_number
  );

  IF v_transaction.type IN ('income', 'expense') THEN
    PERFORM create_journal_entry_line(
      v_reversal_entry_id,
      v_transaction.chart_account_id,
      CASE 
        WHEN v_transaction.type = 'expense' THEN v_transaction.amount
        ELSE NULL
      END,
      CASE 
        WHEN v_transaction.type = 'income' THEN v_transaction.amount
        ELSE NULL
      END,
      v_transaction.description
    );

    PERFORM create_journal_entry_line(
      v_reversal_entry_id,
      v_transaction.account_id,
      CASE 
        WHEN v_transaction.type = 'income' THEN v_transaction.amount
        ELSE NULL
      END,
      CASE 
        WHEN v_transaction.type = 'expense' THEN v_transaction.amount
        ELSE NULL
      END,
      v_transaction.description
    );
  END IF;

  PERFORM set_session_flag('skip_journal_trigger', 'false');

  RETURN json_build_object(
    'success', true,
    'transaction_id', p_transaction_id,
    'reversal_entry_id', v_reversal_entry_id
  );
END;
$$;

-- Fix undo_post_transfer_pair function
CREATE OR REPLACE FUNCTION undo_post_transfer_pair(
  p_transfer_pair_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
  v_from_transaction RECORD;
  v_to_transaction RECORD;
  v_from_entry_id UUID;
  v_to_entry_id UUID;
  v_reversal_entry_id UUID;
  v_entry_number TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT t1.*, t2.id as to_id, t2.current_journal_entry_id as to_journal_id
  INTO v_from_transaction
  FROM transactions t1
  JOIN transactions t2 ON t2.transfer_pair_id = t1.transfer_pair_id AND t2.id != t1.id
  WHERE t1.transfer_pair_id = p_transfer_pair_id
    AND t1.amount < 0
  LIMIT 1;

  IF v_from_transaction IS NULL THEN
    RAISE EXCEPTION 'Transfer pair not found';
  END IF;

  v_profile_id := v_from_transaction.profile_id;
  v_from_entry_id := v_from_transaction.current_journal_entry_id;
  v_to_entry_id := v_from_transaction.to_journal_id;

  IF v_from_entry_id IS NULL THEN
    RAISE EXCEPTION 'No journal entry found for from transaction';
  END IF;

  SELECT entry_number INTO v_entry_number
  FROM journal_entries
  WHERE id = v_from_entry_id;

  PERFORM set_session_flag('skip_journal_trigger', 'true');

  UPDATE transactions
  SET 
    transaction_status = 'pending',
    current_journal_entry_id = NULL
  WHERE transfer_pair_id = p_transfer_pair_id;

  v_reversal_entry_id := create_journal_entry(
    p_profile_id := v_profile_id,
    p_entry_type := 'adjustment',
    p_entry_date := v_from_transaction.date,
    p_description := 'Reversal of: Transfer',
    p_source := 'transfer',
    p_reverses_entry_id := v_from_entry_id,
    p_entry_number := v_entry_number
  );

  PERFORM create_journal_entry_line(
    v_reversal_entry_id,
    v_from_transaction.account_id,
    ABS(v_from_transaction.amount),
    NULL,
    'Reversal'
  );

  SELECT * INTO v_to_transaction
  FROM transactions
  WHERE id = v_from_transaction.to_id;

  PERFORM create_journal_entry_line(
    v_reversal_entry_id,
    v_to_transaction.account_id,
    NULL,
    v_to_transaction.amount,
    'Reversal'
  );

  PERFORM set_session_flag('skip_journal_trigger', 'false');

  RETURN json_build_object(
    'success', true,
    'transfer_pair_id', p_transfer_pair_id,
    'reversal_entry_id', v_reversal_entry_id
  );
END;
$$;

-- Fix undo_post_cc_payment_pair function
CREATE OR REPLACE FUNCTION undo_post_cc_payment_pair(
  p_cc_payment_pair_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
  v_payment_transaction RECORD;
  v_charge_transaction RECORD;
  v_payment_entry_id UUID;
  v_reversal_entry_id UUID;
  v_entry_number TEXT;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT t1.*, t2.id as charge_id, t2.current_journal_entry_id as charge_journal_id
  INTO v_payment_transaction
  FROM transactions t1
  JOIN transactions t2 ON t2.cc_payment_pair_id = t1.cc_payment_pair_id AND t2.id != t1.id
  WHERE t1.cc_payment_pair_id = p_cc_payment_pair_id
    AND t1.amount < 0
  LIMIT 1;

  IF v_payment_transaction IS NULL THEN
    RAISE EXCEPTION 'Credit card payment pair not found';
  END IF;

  v_profile_id := v_payment_transaction.profile_id;
  v_payment_entry_id := v_payment_transaction.current_journal_entry_id;

  IF v_payment_entry_id IS NULL THEN
    RAISE EXCEPTION 'No journal entry found for payment transaction';
  END IF;

  SELECT entry_number INTO v_entry_number
  FROM journal_entries
  WHERE id = v_payment_entry_id;

  PERFORM set_session_flag('skip_journal_trigger', 'true');

  UPDATE transactions
  SET 
    transaction_status = 'pending',
    current_journal_entry_id = NULL
  WHERE cc_payment_pair_id = p_cc_payment_pair_id;

  v_reversal_entry_id := create_journal_entry(
    p_profile_id := v_profile_id,
    p_entry_type := 'adjustment',
    p_entry_date := v_payment_transaction.date,
    p_description := 'Reversal of: Credit Card Payment',
    p_source := 'cc_payment',
    p_reverses_entry_id := v_payment_entry_id,
    p_entry_number := v_entry_number
  );

  PERFORM create_journal_entry_line(
    v_reversal_entry_id,
    v_payment_transaction.account_id,
    ABS(v_payment_transaction.amount),
    NULL,
    'Reversal'
  );

  SELECT * INTO v_charge_transaction
  FROM transactions
  WHERE id = v_payment_transaction.charge_id;

  PERFORM create_journal_entry_line(
    v_reversal_entry_id,
    v_charge_transaction.account_id,
    NULL,
    ABS(v_charge_transaction.amount),
    'Reversal'
  );

  PERFORM set_session_flag('skip_journal_trigger', 'false');

  RETURN json_build_object(
    'success', true,
    'cc_payment_pair_id', p_cc_payment_pair_id,
    'reversal_entry_id', v_reversal_entry_id
  );
END;
$$;
