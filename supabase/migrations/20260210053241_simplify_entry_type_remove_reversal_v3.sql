/*
  # Simplify Entry Types - Remove "reversal" Type

  ## Summary
  Eliminates redundant entry types. Simplifies to just two types:
  - transaction: Posted from transactions table (income/expense/transfer/cc_payment)
  - adjustment: Manual journal entry, opening balance, or undo-post reversal
  
  The reverses_entry_id field already captures the reversal relationship.

  ## Changes
  1. Drop existing entry_type constraints
  2. Update all entries to use simplified types
  3. Add new constraint with only 'transaction' and 'adjustment'
  4. Update all functions that create entries to use correct types

  ## Logic
  - entry_type = 'transaction': Posted from transactions table
  - entry_type = 'adjustment': Manual, opening balance, or reversal
  - reverses_entry_id IS NOT NULL: This adjustment reverses another entry
*/

-- Drop all existing entry_type constraints
ALTER TABLE journal_entries
  DROP CONSTRAINT IF EXISTS journal_entries_entry_type_check;

ALTER TABLE journal_entries
  DROP CONSTRAINT IF EXISTS valid_entry_type;

-- Update all existing entries to use the simplified types
UPDATE journal_entries
SET entry_type = 'adjustment'
WHERE entry_type IN ('reversal', 'opening_balance', 'reclassification', 'closing', 'depreciation', 'accrual');

UPDATE journal_entries
SET entry_type = 'transaction'
WHERE entry_type IN ('transfer', 'cc_payment');

-- Add new simplified constraint
ALTER TABLE journal_entries
  ADD CONSTRAINT journal_entries_entry_type_check 
  CHECK (entry_type IN ('transaction', 'adjustment'));

-- Update the undo_post_transaction function to create adjustments instead of reversals
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
    p_entry_date := v_transaction.transaction_date,
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

-- Update undo_post_transfer_pair function
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
    p_entry_date := v_from_transaction.transaction_date,
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

-- Update undo_post_cc_payment_pair function
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
    p_entry_date := v_payment_transaction.transaction_date,
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

COMMENT ON COLUMN journal_entries.entry_type IS 
'Type of journal entry: transaction (from posted transaction) or adjustment (manual entry or reversal)';

COMMENT ON COLUMN journal_entries.reverses_entry_id IS 
'If this is a reversal adjustment, points to the original entry being reversed';
