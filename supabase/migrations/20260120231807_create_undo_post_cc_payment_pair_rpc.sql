/*
  # Create undo_post_cc_payment_pair RPC

  ## Summary
  Unposts a credit card payment pair atomically with strict validation.
  Same logic as transfer pair but uses credit_card_payment_id.
  
  ## Key Safety Checks
  1. EXACTLY 2 transactions enforced
  2. Same profile_id for both transactions
  3. Profile membership check (unless service_role)
  4. Atomic state: both posted OR both pending (no mixed)
  5. Must share same current_journal_entry_id
  6. Creates ONE reversal JE for shared JE
  7. Blocks reversing a reversal (entry_type='reversal')
  
  ## Parameters
  - p_payment_id: UUID of the credit card payment pair
  - p_reason: Text reason for unposting
  
  ## Returns
  - jsonb with status and details
  
  ## Security
  - SECURITY DEFINER with search_path set
  - Uses auth.uid() (no user spoofing)
  - Enforces profile membership
  - Period lock enforcement
*/

CREATE OR REPLACE FUNCTION undo_post_cc_payment_pair(
  p_payment_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_txn_count INTEGER;
  v_profile_id UUID;
  v_profile_ids UUID[];
  v_shared_je_id UUID;
  v_je_count INTEGER;
  v_posted_count INTEGER;
  v_pending_count INTEGER;
  v_is_member BOOLEAN;
  v_reversal_entry_id UUID;
  v_reversal_entry_number TEXT;
  v_je_type TEXT;
  v_period_locked BOOLEAN := false;
  v_txn_date DATE;
  v_result jsonb;
BEGIN
  -- Get user_id (auth.uid() or service_role bypass)
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL AND current_role != 'service_role' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- SAFETY CHECK 1: EXACTLY 2 transactions
  SELECT COUNT(*) INTO v_txn_count
  FROM transactions
  WHERE credit_card_payment_id = p_payment_id;

  IF v_txn_count = 0 THEN
    RAISE EXCEPTION 'Credit card payment pair % not found', p_payment_id;
  END IF;

  IF v_txn_count != 2 THEN
    RAISE EXCEPTION 'Invalid payment pair: expected 2 transactions, found %', v_txn_count;
  END IF;

  -- SAFETY CHECK 2: Same profile_id for both transactions
  SELECT ARRAY_AGG(DISTINCT profile_id) INTO v_profile_ids
  FROM transactions
  WHERE credit_card_payment_id = p_payment_id;

  IF array_length(v_profile_ids, 1) > 1 THEN
    RAISE EXCEPTION 'Invalid payment pair: transactions belong to different profiles';
  END IF;

  v_profile_id := v_profile_ids[1];

  -- SAFETY CHECK 3: Profile membership check (unless service_role)
  IF current_role != 'service_role' THEN
    SELECT EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_id = v_profile_id
      AND user_id = v_user_id
    ) INTO v_is_member;

    IF NOT v_is_member THEN
      RAISE EXCEPTION 'Access denied: not a member of this profile';
    END IF;
  END IF;

  -- SAFETY CHECK 4: Atomic state check (both posted OR both pending)
  SELECT
    COUNT(*) FILTER (WHERE status = 'posted'),
    COUNT(*) FILTER (WHERE status = 'pending')
  INTO v_posted_count, v_pending_count
  FROM transactions
  WHERE credit_card_payment_id = p_payment_id;

  -- Idempotent: if both already pending, return success
  IF v_pending_count = 2 THEN
    RETURN jsonb_build_object(
      'status', 'already_pending',
      'message', 'Payment pair is already in pending status',
      'payment_id', p_payment_id
    );
  END IF;

  -- Require both posted
  IF v_posted_count != 2 THEN
    RAISE EXCEPTION 'Invalid state: payment pair must have both transactions posted (found % posted, % pending)',
      v_posted_count, v_pending_count;
  END IF;

  -- SAFETY CHECK 5: Must share same current_journal_entry_id
  SELECT COUNT(DISTINCT current_journal_entry_id) INTO v_je_count
  FROM transactions
  WHERE credit_card_payment_id = p_payment_id
  AND current_journal_entry_id IS NOT NULL;

  IF v_je_count != 1 THEN
    RAISE EXCEPTION 'Invalid state: payment pair transactions must share same journal entry (found % distinct entries)',
      v_je_count;
  END IF;

  -- Get shared journal entry ID
  SELECT current_journal_entry_id INTO v_shared_je_id
  FROM transactions
  WHERE credit_card_payment_id = p_payment_id
  AND current_journal_entry_id IS NOT NULL
  LIMIT 1;

  IF v_shared_je_id IS NULL THEN
    RAISE EXCEPTION 'Invalid state: no journal entry found for payment pair';
  END IF;

  -- SAFETY CHECK 6: Block reversing a reversal
  SELECT entry_type INTO v_je_type
  FROM journal_entries
  WHERE id = v_shared_je_id;

  IF v_je_type = 'reversal' THEN
    RAISE EXCEPTION 'Cannot reverse a reversal entry. Only original entries can be reversed.';
  END IF;

  -- Check accounting period lock
  SELECT transaction_date INTO v_txn_date
  FROM transactions
  WHERE credit_card_payment_id = p_payment_id
  LIMIT 1;

  SELECT EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE profile_id = v_profile_id
    AND v_txn_date BETWEEN start_date AND end_date
    AND (
      is_locked = true
      OR (lock_date IS NOT NULL AND v_txn_date <= lock_date)
    )
  ) INTO v_period_locked;

  IF v_period_locked THEN
    RAISE EXCEPTION 'Cannot undo post: transaction date is within a locked accounting period';
  END IF;

  -- Generate reversal entry number
  v_reversal_entry_number := generate_journal_entry_number(v_profile_id, 'reversal');

  -- Create ONE reversal journal entry for the shared JE
  INSERT INTO journal_entries (
    profile_id,
    user_id,
    entry_date,
    entry_number,
    description,
    entry_type,
    source,
    reverses_entry_id
  )
  SELECT
    profile_id,
    COALESCE(v_user_id, user_id),
    CURRENT_DATE,
    v_reversal_entry_number,
    'REVERSAL: ' || description,
    'reversal',
    'undo_post',
    v_shared_je_id
  FROM journal_entries
  WHERE id = v_shared_je_id
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
  WHERE journal_entry_id = v_shared_je_id
  ORDER BY line_number;

  -- Validate reversal entry balance
  PERFORM validate_journal_entry_balance(v_reversal_entry_id);

  -- Mark original entry as reversed
  UPDATE journal_entries
  SET reversed_by_entry_id = v_reversal_entry_id
  WHERE id = v_shared_je_id;

  -- Update BOTH transactions to pending with undo metadata
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
    WHERE credit_card_payment_id = p_payment_id;
    
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
    'message', 'Payment pair unposted successfully',
    'payment_id', p_payment_id,
    'transactions_updated', 2,
    'reversal_entry_id', v_reversal_entry_id,
    'reversal_entry_number', v_reversal_entry_number
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION undo_post_cc_payment_pair IS
'Unposts a credit card payment pair atomically with strict validation. Same logic as transfer pairs but for CC payments.';
