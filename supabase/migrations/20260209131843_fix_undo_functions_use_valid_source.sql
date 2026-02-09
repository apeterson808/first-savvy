/*
  # Fix Undo Functions to Use Valid Source Value

  ## Problem
  The undo functions try to insert 'undo_post' as the source for reversal journal entries,
  but the valid_source constraint only allows: 'manual', 'import', 'system', 'migration'.

  ## Solution
  Update all three undo functions to use 'system' as the source since these are 
  system-generated reversal entries.

  ## Impact
  - Undo functionality will work properly
  - Reversal entries will be created with valid source
*/

-- Fix undo_post_transaction
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

  IF v_transaction.current_journal_entry_id IS NOT NULL THEN
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
      CURRENT_DATE,
      v_reversal_entry_number,
      'REVERSAL: ' || COALESCE(v_transaction.description, v_transaction.original_description),
      'reversal',
      'system',
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
  ELSE
    RAISE WARNING 'Transaction % has no journal entry to reverse', p_transaction_id;
  END IF;

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
    'reversal_entry_number', v_reversal_entry_number,
    'had_journal_entry', v_transaction.current_journal_entry_id IS NOT NULL
  );

  RETURN v_result;
END;
$$;

-- Fix undo_post_transfer_pair
CREATE OR REPLACE FUNCTION undo_post_transfer_pair(
  p_pair_id UUID,
  p_reason TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id UUID;
  v_profile_id UUID;
  v_profile_ids UUID[];
  v_is_member BOOLEAN;
  v_posted_count INT;
  v_pending_count INT;
  v_je_count INT;
  v_shared_je_id UUID;
  v_je_type TEXT;
  v_reversal_entry_id UUID;
  v_reversal_entry_number TEXT;
  v_txn_date DATE;
  v_period_locked BOOLEAN := false;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL AND current_role != 'service_role' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF (SELECT COUNT(*) FROM transactions WHERE transfer_pair_id = p_pair_id) != 2 THEN
    RAISE EXCEPTION 'Transfer pair % not found or invalid', p_pair_id;
  END IF;

  SELECT array_agg(DISTINCT profile_id) INTO v_profile_ids
  FROM transactions
  WHERE transfer_pair_id = p_pair_id;

  IF array_length(v_profile_ids, 1) > 1 THEN
    RAISE EXCEPTION 'Invalid transfer pair: transactions belong to different profiles';
  END IF;

  v_profile_id := v_profile_ids[1];

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

  SELECT
    COUNT(*) FILTER (WHERE status = 'posted'),
    COUNT(*) FILTER (WHERE status = 'pending')
  INTO v_posted_count, v_pending_count
  FROM transactions
  WHERE transfer_pair_id = p_pair_id;

  IF v_pending_count = 2 THEN
    RETURN jsonb_build_object(
      'status', 'already_pending',
      'message', 'Transfer pair is already in pending status',
      'pair_id', p_pair_id
    );
  END IF;

  IF v_posted_count != 2 THEN
    RAISE EXCEPTION 'Invalid state: transfer pair must have both transactions posted (found % posted, % pending)',
      v_posted_count, v_pending_count;
  END IF;

  SELECT COUNT(DISTINCT current_journal_entry_id) INTO v_je_count
  FROM transactions
  WHERE transfer_pair_id = p_pair_id
  AND current_journal_entry_id IS NOT NULL;

  SELECT current_journal_entry_id INTO v_shared_je_id
  FROM transactions
  WHERE transfer_pair_id = p_pair_id
  AND current_journal_entry_id IS NOT NULL
  LIMIT 1;

  SELECT date INTO v_txn_date
  FROM transactions
  WHERE transfer_pair_id = p_pair_id
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

  IF v_shared_je_id IS NOT NULL THEN
    IF v_je_count != 1 THEN
      RAISE EXCEPTION 'Invalid state: transfer pair transactions must share same journal entry (found % distinct entries)',
        v_je_count;
    END IF;

    SELECT entry_type INTO v_je_type
    FROM journal_entries
    WHERE id = v_shared_je_id;

    IF v_je_type = 'reversal' THEN
      RAISE EXCEPTION 'Cannot reverse a reversal entry. Only original entries can be reversed.';
    END IF;

    v_reversal_entry_number := generate_journal_entry_number(v_profile_id, 'reversal');

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
      'REVERSAL: Transfer between accounts',
      'reversal',
      'system',
      v_shared_je_id
    FROM journal_entries
    WHERE id = v_shared_je_id
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
    WHERE journal_entry_id = v_shared_je_id
    ORDER BY line_number;

    PERFORM validate_journal_entry_balance(v_reversal_entry_id);

    UPDATE journal_entries
    SET reversed_by_entry_id = v_reversal_entry_id
    WHERE id = v_shared_je_id;
  ELSE
    RAISE WARNING 'Transfer pair % has no journal entries to reverse', p_pair_id;
  END IF;

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
    WHERE transfer_pair_id = p_pair_id;
    
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.internal_status_write', 'false', true);
    RAISE;
  END;

  PERFORM set_config('app.internal_status_write', 'false', true);

  v_result := jsonb_build_object(
    'status', 'success',
    'message', 'Transfer pair unposted successfully',
    'pair_id', p_pair_id,
    'reversal_entry_id', v_reversal_entry_id,
    'reversal_entry_number', v_reversal_entry_number,
    'had_journal_entry', v_shared_je_id IS NOT NULL
  );

  RETURN v_result;
END;
$$;

-- Fix undo_post_cc_payment_pair
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
  v_profile_id UUID;
  v_profile_ids UUID[];
  v_is_member BOOLEAN;
  v_posted_count INT;
  v_pending_count INT;
  v_je_count INT;
  v_shared_je_id UUID;
  v_je_type TEXT;
  v_reversal_entry_id UUID;
  v_reversal_entry_number TEXT;
  v_txn_date DATE;
  v_period_locked BOOLEAN := false;
  v_result jsonb;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL AND current_role != 'service_role' THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF (SELECT COUNT(*) FROM transactions WHERE cc_payment_pair_id = p_payment_id) != 2 THEN
    RAISE EXCEPTION 'Credit card payment pair % not found or invalid', p_payment_id;
  END IF;

  SELECT array_agg(DISTINCT profile_id) INTO v_profile_ids
  FROM transactions
  WHERE cc_payment_pair_id = p_payment_id;

  IF array_length(v_profile_ids, 1) > 1 THEN
    RAISE EXCEPTION 'Invalid payment pair: transactions belong to different profiles';
  END IF;

  v_profile_id := v_profile_ids[1];

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

  SELECT
    COUNT(*) FILTER (WHERE status = 'posted'),
    COUNT(*) FILTER (WHERE status = 'pending')
  INTO v_posted_count, v_pending_count
  FROM transactions
  WHERE cc_payment_pair_id = p_payment_id;

  IF v_pending_count = 2 THEN
    RETURN jsonb_build_object(
      'status', 'already_pending',
      'message', 'Payment pair is already in pending status',
      'payment_id', p_payment_id
    );
  END IF;

  IF v_posted_count != 2 THEN
    RAISE EXCEPTION 'Invalid state: payment pair must have both transactions posted (found % posted, % pending)',
      v_posted_count, v_pending_count;
  END IF;

  SELECT COUNT(DISTINCT current_journal_entry_id) INTO v_je_count
  FROM transactions
  WHERE cc_payment_pair_id = p_payment_id
  AND current_journal_entry_id IS NOT NULL;

  SELECT current_journal_entry_id INTO v_shared_je_id
  FROM transactions
  WHERE cc_payment_pair_id = p_payment_id
  AND current_journal_entry_id IS NOT NULL
  LIMIT 1;

  SELECT date INTO v_txn_date
  FROM transactions
  WHERE cc_payment_pair_id = p_payment_id
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

  IF v_shared_je_id IS NOT NULL THEN
    IF v_je_count != 1 THEN
      RAISE EXCEPTION 'Invalid state: payment pair transactions must share same journal entry (found % distinct entries)',
        v_je_count;
    END IF;

    SELECT entry_type INTO v_je_type
    FROM journal_entries
    WHERE id = v_shared_je_id;

    IF v_je_type = 'reversal' THEN
      RAISE EXCEPTION 'Cannot reverse a reversal entry. Only original entries can be reversed.';
    END IF;

    v_reversal_entry_number := generate_journal_entry_number(v_profile_id, 'reversal');

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
      'REVERSAL: Credit card payment',
      'reversal',
      'system',
      v_shared_je_id
    FROM journal_entries
    WHERE id = v_shared_je_id
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
    WHERE journal_entry_id = v_shared_je_id
    ORDER BY line_number;

    PERFORM validate_journal_entry_balance(v_reversal_entry_id);

    UPDATE journal_entries
    SET reversed_by_entry_id = v_reversal_entry_id
    WHERE id = v_shared_je_id;
  ELSE
    RAISE WARNING 'Payment pair % has no journal entries to reverse', p_payment_id;
  END IF;

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
    WHERE cc_payment_pair_id = p_payment_id;
    
  EXCEPTION WHEN OTHERS THEN
    PERFORM set_config('app.internal_status_write', 'false', true);
    RAISE;
  END;

  PERFORM set_config('app.internal_status_write', 'false', true);

  v_result := jsonb_build_object(
    'status', 'success',
    'message', 'Payment pair unposted successfully',
    'payment_id', p_payment_id,
    'reversal_entry_id', v_reversal_entry_id,
    'reversal_entry_number', v_reversal_entry_number,
    'had_journal_entry', v_shared_je_id IS NOT NULL
  );

  RETURN v_result;
END;
$$;
