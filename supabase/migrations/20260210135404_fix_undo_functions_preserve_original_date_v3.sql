/*
  # Fix Undo Functions to Preserve Original Transaction Date

  ## Summary
  Updates all undo functions to create reversal journal entries with the same
  date as the original transaction, not the current date.

  ## Changes
  1. undo_post_transaction: Use v_transaction.date instead of CURRENT_DATE
  2. undo_post_transfer_pair: Use transaction date instead of CURRENT_DATE
  3. undo_post_cc_payment_pair: Use transaction date instead of CURRENT_DATE

  ## Purpose
  - Date column shows original transaction date (consistent across all entries)
  - Action Time (created_at) shows when the reversal was performed
  - Maintains audit trail integrity
*/

-- Drop all versions of these functions
DROP FUNCTION IF EXISTS undo_post_transaction(uuid);
DROP FUNCTION IF EXISTS undo_post_transaction(uuid, text);
DROP FUNCTION IF EXISTS undo_post_transfer_pair(uuid);
DROP FUNCTION IF EXISTS undo_post_transfer_pair(uuid, text);
DROP FUNCTION IF EXISTS undo_post_cc_payment_pair(uuid);
DROP FUNCTION IF EXISTS undo_post_cc_payment_pair(uuid, text);

-- Fix undo_post_transaction
CREATE FUNCTION undo_post_transaction(
  p_transaction_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_transaction RECORD;
  v_reversal_entry_id UUID;
  v_reversal_entry_number TEXT;
  v_is_member BOOLEAN;
  v_period_locked BOOLEAN := false;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL AND current_role != 'service_role' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_transaction
  FROM transactions
  WHERE id = p_transaction_id;

  IF v_transaction IS NULL THEN
    RAISE EXCEPTION 'Transaction % not found', p_transaction_id;
  END IF;

  IF v_transaction.status = 'pending' THEN
    RETURN jsonb_build_object(
      'status', 'already_pending',
      'message', 'Transaction is already in pending status',
      'transaction_id', p_transaction_id
    );
  END IF;

  IF v_transaction.status != 'posted' THEN
    RAISE EXCEPTION 'Cannot undo post: transaction status is %, expected posted', v_transaction.status;
  END IF;

  IF v_transaction.current_journal_entry_id IS NULL THEN
    RAISE EXCEPTION 'Cannot undo post: no current journal entry found';
  END IF;

  IF current_role != 'service_role' THEN
    SELECT EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_id = v_transaction.profile_id
      AND user_id = v_user_id
    ) INTO v_is_member;

    IF NOT v_is_member THEN
      RAISE EXCEPTION 'Access denied: not a member of this profile';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE profile_id = v_transaction.profile_id
    AND v_transaction.date BETWEEN start_date AND end_date
    AND (
      is_locked = true
      OR (lock_date IS NOT NULL AND v_transaction.date <= lock_date)
    )
  ) INTO v_period_locked;

  IF v_period_locked THEN
    RAISE EXCEPTION 'Cannot undo post: transaction date is within a locked accounting period';
  END IF;

  v_reversal_entry_number := generate_journal_entry_number(v_transaction.profile_id, 'reversal');

  INSERT INTO journal_entries (
    profile_id,
    user_id,
    entry_date,
    entry_number,
    description,
    entry_type,
    source,
    reverses_entry_id
  ) VALUES (
    v_transaction.profile_id,
    COALESCE(v_user_id, v_transaction.user_id),
    v_transaction.date,
    v_reversal_entry_number,
    'REVERSAL: ' || COALESCE(v_transaction.description, v_transaction.original_description),
    'reversal',
    'undo_post',
    v_transaction.current_journal_entry_id
  )
  RETURNING id INTO v_reversal_entry_id;

  INSERT INTO journal_entry_lines (
    journal_entry_id,
    profile_id,
    user_id,
    account_id,
    line_number,
    debit_amount,
    credit_amount,
    description
  )
  SELECT
    v_reversal_entry_id,
    profile_id,
    COALESCE(v_user_id, user_id),
    account_id,
    line_number,
    credit_amount,
    debit_amount,
    'REVERSAL: ' || COALESCE(description, '')
  FROM journal_entry_lines
  WHERE journal_entry_id = v_transaction.current_journal_entry_id
  ORDER BY line_number;

  PERFORM validate_journal_entry_balance(v_reversal_entry_id);

  UPDATE journal_entries
  SET reversed_by_entry_id = v_reversal_entry_id
  WHERE id = v_transaction.current_journal_entry_id;

  BEGIN
    PERFORM set_config('app.internal_status_write', 'true', true);
    
    UPDATE transactions
    SET
      status = 'pending',
      current_journal_entry_id = NULL,
      journal_entry_id = NULL,
      unposted_at = NOW(),
      unposted_by = COALESCE(v_user_id, user_id),
      unposted_reversal_entry_id = v_reversal_entry_id,
      unposted_reason = p_reason
    WHERE id = p_transaction_id;
    
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.internal_status_write', 'false', true);
    RAISE;
  END;

  PERFORM set_config('app.internal_status_write', 'false', true);

  v_result := jsonb_build_object(
    'status', 'success',
    'message', 'Transaction unposted successfully',
    'transaction_id', p_transaction_id,
    'reversal_entry_id', v_reversal_entry_id,
    'reversal_entry_number', v_reversal_entry_number
  );

  RETURN v_result;
END;
$$;

-- Fix undo_post_transfer_pair (matching the signature with p_from_transaction_id and p_to_transaction_id)
CREATE FUNCTION undo_post_transfer_pair(
  p_from_transaction_id UUID,
  p_to_transaction_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_from_transaction RECORD;
  v_to_transaction RECORD;
  v_from_reversal_entry_id UUID;
  v_to_reversal_entry_id UUID;
  v_from_reversal_entry_number TEXT;
  v_to_reversal_entry_number TEXT;
  v_is_member BOOLEAN;
  v_period_locked BOOLEAN := false;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL AND current_role != 'service_role' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_from_transaction
  FROM transactions
  WHERE id = p_from_transaction_id;

  SELECT * INTO v_to_transaction
  FROM transactions
  WHERE id = p_to_transaction_id;

  IF v_from_transaction IS NULL OR v_to_transaction IS NULL THEN
    RAISE EXCEPTION 'One or both transactions not found';
  END IF;

  IF v_from_transaction.status = 'pending' AND v_to_transaction.status = 'pending' THEN
    RETURN jsonb_build_object(
      'status', 'already_pending',
      'message', 'Both transactions are already in pending status',
      'from_transaction_id', p_from_transaction_id,
      'to_transaction_id', p_to_transaction_id
    );
  END IF;

  IF v_from_transaction.status != 'posted' OR v_to_transaction.status != 'posted' THEN
    RAISE EXCEPTION 'Cannot undo post: both transactions must be posted';
  END IF;

  IF v_from_transaction.current_journal_entry_id IS NULL OR v_to_transaction.current_journal_entry_id IS NULL THEN
    RAISE EXCEPTION 'Cannot undo post: one or both transactions missing journal entries';
  END IF;

  IF current_role != 'service_role' THEN
    SELECT EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_id = v_from_transaction.profile_id
      AND user_id = v_user_id
    ) INTO v_is_member;

    IF NOT v_is_member THEN
      RAISE EXCEPTION 'Access denied: not a member of this profile';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE profile_id = v_from_transaction.profile_id
    AND (
      (v_from_transaction.date BETWEEN start_date AND end_date)
      OR (v_to_transaction.date BETWEEN start_date AND end_date)
    )
    AND (
      is_locked = true
      OR (lock_date IS NOT NULL AND LEAST(v_from_transaction.date, v_to_transaction.date) <= lock_date)
    )
  ) INTO v_period_locked;

  IF v_period_locked THEN
    RAISE EXCEPTION 'Cannot undo post: one or both transaction dates are within a locked accounting period';
  END IF;

  v_from_reversal_entry_number := generate_journal_entry_number(v_from_transaction.profile_id, 'reversal');
  v_to_reversal_entry_number := generate_journal_entry_number(v_to_transaction.profile_id, 'reversal');

  INSERT INTO journal_entries (
    profile_id,
    user_id,
    entry_date,
    entry_number,
    description,
    entry_type,
    source,
    reverses_entry_id
  ) VALUES (
    v_from_transaction.profile_id,
    COALESCE(v_user_id, v_from_transaction.user_id),
    v_from_transaction.date,
    v_from_reversal_entry_number,
    'REVERSAL: ' || COALESCE(v_from_transaction.description, v_from_transaction.original_description),
    'reversal',
    'undo_post',
    v_from_transaction.current_journal_entry_id
  )
  RETURNING id INTO v_from_reversal_entry_id;

  INSERT INTO journal_entries (
    profile_id,
    user_id,
    entry_date,
    entry_number,
    description,
    entry_type,
    source,
    reverses_entry_id
  ) VALUES (
    v_to_transaction.profile_id,
    COALESCE(v_user_id, v_to_transaction.user_id),
    v_to_transaction.date,
    v_to_reversal_entry_number,
    'REVERSAL: ' || COALESCE(v_to_transaction.description, v_to_transaction.original_description),
    'reversal',
    'undo_post',
    v_to_transaction.current_journal_entry_id
  )
  RETURNING id INTO v_to_reversal_entry_id;

  INSERT INTO journal_entry_lines (
    journal_entry_id,
    profile_id,
    user_id,
    account_id,
    line_number,
    debit_amount,
    credit_amount,
    description
  )
  SELECT
    v_from_reversal_entry_id,
    profile_id,
    COALESCE(v_user_id, user_id),
    account_id,
    line_number,
    credit_amount,
    debit_amount,
    'REVERSAL: ' || COALESCE(description, '')
  FROM journal_entry_lines
  WHERE journal_entry_id = v_from_transaction.current_journal_entry_id
  ORDER BY line_number;

  INSERT INTO journal_entry_lines (
    journal_entry_id,
    profile_id,
    user_id,
    account_id,
    line_number,
    debit_amount,
    credit_amount,
    description
  )
  SELECT
    v_to_reversal_entry_id,
    profile_id,
    COALESCE(v_user_id, user_id),
    account_id,
    line_number,
    credit_amount,
    debit_amount,
    'REVERSAL: ' || COALESCE(description, '')
  FROM journal_entry_lines
  WHERE journal_entry_id = v_to_transaction.current_journal_entry_id
  ORDER BY line_number;

  PERFORM validate_journal_entry_balance(v_from_reversal_entry_id);
  PERFORM validate_journal_entry_balance(v_to_reversal_entry_id);

  UPDATE journal_entries
  SET reversed_by_entry_id = v_from_reversal_entry_id
  WHERE id = v_from_transaction.current_journal_entry_id;

  UPDATE journal_entries
  SET reversed_by_entry_id = v_to_reversal_entry_id
  WHERE id = v_to_transaction.current_journal_entry_id;

  BEGIN
    PERFORM set_config('app.internal_status_write', 'true', true);
    
    UPDATE transactions
    SET
      status = 'pending',
      current_journal_entry_id = NULL,
      journal_entry_id = NULL,
      unposted_at = NOW(),
      unposted_by = COALESCE(v_user_id, user_id),
      unposted_reversal_entry_id = v_from_reversal_entry_id,
      unposted_reason = p_reason
    WHERE id = p_from_transaction_id;

    UPDATE transactions
    SET
      status = 'pending',
      current_journal_entry_id = NULL,
      journal_entry_id = NULL,
      unposted_at = NOW(),
      unposted_by = COALESCE(v_user_id, user_id),
      unposted_reversal_entry_id = v_to_reversal_entry_id,
      unposted_reason = p_reason
    WHERE id = p_to_transaction_id;
    
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.internal_status_write', 'false', true);
    RAISE;
  END;

  PERFORM set_config('app.internal_status_write', 'false', true);

  v_result := jsonb_build_object(
    'status', 'success',
    'message', 'Transfer pair unposted successfully',
    'from_transaction_id', p_from_transaction_id,
    'to_transaction_id', p_to_transaction_id,
    'from_reversal_entry_id', v_from_reversal_entry_id,
    'to_reversal_entry_id', v_to_reversal_entry_id
  );

  RETURN v_result;
END;
$$;

-- Fix undo_post_cc_payment_pair
CREATE FUNCTION undo_post_cc_payment_pair(
  p_bank_transaction_id UUID,
  p_cc_transaction_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_bank_transaction RECORD;
  v_cc_transaction RECORD;
  v_bank_reversal_entry_id UUID;
  v_cc_reversal_entry_id UUID;
  v_bank_reversal_entry_number TEXT;
  v_cc_reversal_entry_number TEXT;
  v_is_member BOOLEAN;
  v_period_locked BOOLEAN := false;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL AND current_role != 'service_role' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_bank_transaction
  FROM transactions
  WHERE id = p_bank_transaction_id;

  SELECT * INTO v_cc_transaction
  FROM transactions
  WHERE id = p_cc_transaction_id;

  IF v_bank_transaction IS NULL OR v_cc_transaction IS NULL THEN
    RAISE EXCEPTION 'One or both transactions not found';
  END IF;

  IF v_bank_transaction.status = 'pending' AND v_cc_transaction.status = 'pending' THEN
    RETURN jsonb_build_object(
      'status', 'already_pending',
      'message', 'Both transactions are already in pending status',
      'bank_transaction_id', p_bank_transaction_id,
      'cc_transaction_id', p_cc_transaction_id
    );
  END IF;

  IF v_bank_transaction.status != 'posted' OR v_cc_transaction.status != 'posted' THEN
    RAISE EXCEPTION 'Cannot undo post: both transactions must be posted';
  END IF;

  IF v_bank_transaction.current_journal_entry_id IS NULL OR v_cc_transaction.current_journal_entry_id IS NULL THEN
    RAISE EXCEPTION 'Cannot undo post: one or both transactions missing journal entries';
  END IF;

  IF current_role != 'service_role' THEN
    SELECT EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_id = v_bank_transaction.profile_id
      AND user_id = v_user_id
    ) INTO v_is_member;

    IF NOT v_is_member THEN
      RAISE EXCEPTION 'Access denied: not a member of this profile';
    END IF;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE profile_id = v_bank_transaction.profile_id
    AND (
      (v_bank_transaction.date BETWEEN start_date AND end_date)
      OR (v_cc_transaction.date BETWEEN start_date AND end_date)
    )
    AND (
      is_locked = true
      OR (lock_date IS NOT NULL AND LEAST(v_bank_transaction.date, v_cc_transaction.date) <= lock_date)
    )
  ) INTO v_period_locked;

  IF v_period_locked THEN
    RAISE EXCEPTION 'Cannot undo post: one or both transaction dates are within a locked accounting period';
  END IF;

  v_bank_reversal_entry_number := generate_journal_entry_number(v_bank_transaction.profile_id, 'reversal');
  v_cc_reversal_entry_number := generate_journal_entry_number(v_cc_transaction.profile_id, 'reversal');

  INSERT INTO journal_entries (
    profile_id,
    user_id,
    entry_date,
    entry_number,
    description,
    entry_type,
    source,
    reverses_entry_id
  ) VALUES (
    v_bank_transaction.profile_id,
    COALESCE(v_user_id, v_bank_transaction.user_id),
    v_bank_transaction.date,
    v_bank_reversal_entry_number,
    'REVERSAL: ' || COALESCE(v_bank_transaction.description, v_bank_transaction.original_description),
    'reversal',
    'undo_post',
    v_bank_transaction.current_journal_entry_id
  )
  RETURNING id INTO v_bank_reversal_entry_id;

  INSERT INTO journal_entries (
    profile_id,
    user_id,
    entry_date,
    entry_number,
    description,
    entry_type,
    source,
    reverses_entry_id
  ) VALUES (
    v_cc_transaction.profile_id,
    COALESCE(v_user_id, v_cc_transaction.user_id),
    v_cc_transaction.date,
    v_cc_reversal_entry_number,
    'REVERSAL: ' || COALESCE(v_cc_transaction.description, v_cc_transaction.original_description),
    'reversal',
    'undo_post',
    v_cc_transaction.current_journal_entry_id
  )
  RETURNING id INTO v_cc_reversal_entry_id;

  INSERT INTO journal_entry_lines (
    journal_entry_id,
    profile_id,
    user_id,
    account_id,
    line_number,
    debit_amount,
    credit_amount,
    description
  )
  SELECT
    v_bank_reversal_entry_id,
    profile_id,
    COALESCE(v_user_id, user_id),
    account_id,
    line_number,
    credit_amount,
    debit_amount,
    'REVERSAL: ' || COALESCE(description, '')
  FROM journal_entry_lines
  WHERE journal_entry_id = v_bank_transaction.current_journal_entry_id
  ORDER BY line_number;

  INSERT INTO journal_entry_lines (
    journal_entry_id,
    profile_id,
    user_id,
    account_id,
    line_number,
    debit_amount,
    credit_amount,
    description
  )
  SELECT
    v_cc_reversal_entry_id,
    profile_id,
    COALESCE(v_user_id, user_id),
    account_id,
    line_number,
    credit_amount,
    debit_amount,
    'REVERSAL: ' || COALESCE(description, '')
  FROM journal_entry_lines
  WHERE journal_entry_id = v_cc_transaction.current_journal_entry_id
  ORDER BY line_number;

  PERFORM validate_journal_entry_balance(v_bank_reversal_entry_id);
  PERFORM validate_journal_entry_balance(v_cc_reversal_entry_id);

  UPDATE journal_entries
  SET reversed_by_entry_id = v_bank_reversal_entry_id
  WHERE id = v_bank_transaction.current_journal_entry_id;

  UPDATE journal_entries
  SET reversed_by_entry_id = v_cc_reversal_entry_id
  WHERE id = v_cc_transaction.current_journal_entry_id;

  BEGIN
    PERFORM set_config('app.internal_status_write', 'true', true);
    
    UPDATE transactions
    SET
      status = 'pending',
      current_journal_entry_id = NULL,
      journal_entry_id = NULL,
      unposted_at = NOW(),
      unposted_by = COALESCE(v_user_id, user_id),
      unposted_reversal_entry_id = v_bank_reversal_entry_id,
      unposted_reason = p_reason
    WHERE id = p_bank_transaction_id;

    UPDATE transactions
    SET
      status = 'pending',
      current_journal_entry_id = NULL,
      journal_entry_id = NULL,
      unposted_at = NOW(),
      unposted_by = COALESCE(v_user_id, user_id),
      unposted_reversal_entry_id = v_cc_reversal_entry_id,
      unposted_reason = p_reason
    WHERE id = p_cc_transaction_id;
    
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.internal_status_write', 'false', true);
    RAISE;
  END;

  PERFORM set_config('app.internal_status_write', 'false', true);

  v_result := jsonb_build_object(
    'status', 'success',
    'message', 'Credit card payment pair unposted successfully',
    'bank_transaction_id', p_bank_transaction_id,
    'cc_transaction_id', p_cc_transaction_id,
    'bank_reversal_entry_id', v_bank_reversal_entry_id,
    'cc_reversal_entry_id', v_cc_reversal_entry_id
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION undo_post_transaction IS
'Unposts a transaction by creating a reversal journal entry (dated with original transaction date) and returning transaction to pending status.';

COMMENT ON FUNCTION undo_post_transfer_pair IS
'Unposts a transfer pair by creating reversal journal entries (dated with original transaction dates) and returning both transactions to pending status.';

COMMENT ON FUNCTION undo_post_cc_payment_pair IS
'Unposts a credit card payment pair by creating reversal journal entries (dated with original transaction dates) and returning both transactions to pending status.';
