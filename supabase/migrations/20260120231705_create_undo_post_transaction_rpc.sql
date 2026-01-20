/*
  # Create undo_post_transaction RPC

  ## Summary
  Implements reversible posting for tax-ready accounting.
  Creates reversal journal entry and returns transaction to pending status.
  
  ## Key Features
  - Uses auth.uid() (no user spoofing)
  - Enforces profile membership (service_role bypass allowed)
  - Enforces accounting period locks
  - Idempotent (already pending → success)
  - Creates reversal JE with flipped debits/credits
  - Updates transaction with undo metadata
  - Uses session flags for status change authorization
  
  ## Parameters
  - p_transaction_id: UUID of transaction to unpost
  - p_reason: Text reason for unposting (audit trail)
  
  ## Returns
  - jsonb with status, message, and reversal_entry details
  
  ## Security
  - SECURITY DEFINER with search_path set
  - RLS bypassed (function enforces security)
  - Profile membership required
  - Period lock enforcement
*/

CREATE OR REPLACE FUNCTION undo_post_transaction(
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
  -- Get user_id (auth.uid() or service_role bypass)
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL AND current_role != 'service_role' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Get transaction details
  SELECT * INTO v_transaction
  FROM transactions
  WHERE id = p_transaction_id;

  IF v_transaction IS NULL THEN
    RAISE EXCEPTION 'Transaction % not found', p_transaction_id;
  END IF;

  -- Idempotent: if already pending, return success
  IF v_transaction.status = 'pending' THEN
    RETURN jsonb_build_object(
      'status', 'already_pending',
      'message', 'Transaction is already in pending status',
      'transaction_id', p_transaction_id
    );
  END IF;

  -- Verify transaction is posted
  IF v_transaction.status != 'posted' THEN
    RAISE EXCEPTION 'Cannot undo post: transaction status is %, expected posted', v_transaction.status;
  END IF;

  -- Verify current_journal_entry_id exists
  IF v_transaction.current_journal_entry_id IS NULL THEN
    RAISE EXCEPTION 'Cannot undo post: no current journal entry found';
  END IF;

  -- Check profile membership (unless service_role)
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

  -- Check accounting period lock
  SELECT EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE profile_id = v_transaction.profile_id
    AND v_transaction.transaction_date BETWEEN start_date AND end_date
    AND (
      is_locked = true
      OR (lock_date IS NOT NULL AND v_transaction.transaction_date <= lock_date)
    )
  ) INTO v_period_locked;

  IF v_period_locked THEN
    RAISE EXCEPTION 'Cannot undo post: transaction date is within a locked accounting period';
  END IF;

  -- Generate reversal entry number
  v_reversal_entry_number := generate_journal_entry_number(v_transaction.profile_id, 'reversal');

  -- Create reversal journal entry
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
    CURRENT_DATE,
    v_reversal_entry_number,
    'REVERSAL: ' || COALESCE(v_transaction.description, v_transaction.original_description),
    'reversal',
    'undo_post',
    v_transaction.current_journal_entry_id
  )
  RETURNING id INTO v_reversal_entry_id;

  -- Create reversal lines (flip debits and credits)
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
    credit_amount,  -- Flip: credit becomes debit
    debit_amount,   -- Flip: debit becomes credit
    'REVERSAL: ' || COALESCE(description, '')
  FROM journal_entry_lines
  WHERE journal_entry_id = v_transaction.current_journal_entry_id
  ORDER BY line_number;

  -- Validate reversal entry balance
  PERFORM validate_journal_entry_balance(v_reversal_entry_id);

  -- Mark original entry as reversed
  UPDATE journal_entries
  SET reversed_by_entry_id = v_reversal_entry_id
  WHERE id = v_transaction.current_journal_entry_id;

  -- Update transaction to pending with undo metadata
  -- Use session flag to authorize status change
  BEGIN
    PERFORM set_config('app.internal_status_write', 'true', true);
    
    UPDATE transactions
    SET
      status = 'pending',
      current_journal_entry_id = NULL,
      journal_entry_id = NULL,  -- Clear legacy field
      unposted_at = NOW(),
      unposted_by = COALESCE(v_user_id, user_id),
      unposted_reversal_entry_id = v_reversal_entry_id,
      unposted_reason = p_reason
    WHERE id = p_transaction_id;
    
  EXCEPTION WHEN OTHERS THEN
    -- Ensure flag is cleared even on error
    PERFORM set_config('app.internal_status_write', 'false', true);
    RAISE;
  END;

  -- Clear session flag
  PERFORM set_config('app.internal_status_write', 'false', true);

  -- Build result
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

COMMENT ON FUNCTION undo_post_transaction IS
'Unposts a transaction by creating a reversal journal entry and returning transaction to pending status. Enforces profile membership and period locks.';
