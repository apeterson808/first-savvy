/*
  # Update post_transaction to promote existing draft JE

  ## Overview
  The old rpc_post_transaction triggered the auto_create_journal_entry_from_transaction
  trigger by changing status to 'posted'. Now every transaction already has a draft JE
  from the INSERT trigger, so posting simply:

  1. Validates the transaction has a real category (no suspense account remaining)
  2. Validates the JE is balanced
  3. Promotes JE status: draft → posted
  4. Sets transaction status: pending → posted
  5. Logs the post action to audit_logs

  The old auto_create_journal_entry_from_transaction trigger is removed.
*/

-- Remove the old trigger that created JEs at post time (now created at insert)
DROP TRIGGER IF EXISTS auto_create_journal_entry_trigger ON transactions;
DROP FUNCTION IF EXISTS auto_create_journal_entry_from_transaction() CASCADE;

-- Updated rpc_post_transaction: promotes existing draft JE
CREATE OR REPLACE FUNCTION rpc_post_transaction(p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction record;
  v_je_id uuid;
  v_je record;
  v_bank_class text;
  v_suspense_id uuid;
  v_has_suspense boolean;
  v_total_debits numeric;
  v_total_credits numeric;
  v_actor_user_id uuid;
  v_actor_display_name text;
BEGIN
  SELECT * INTO v_transaction FROM transactions WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
  END IF;

  IF NOT has_profile_access(v_transaction.profile_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_transaction.status = 'voided' THEN
    RAISE EXCEPTION 'Cannot post a voided transaction';
  END IF;

  IF v_transaction.status = 'posted' THEN
    RAISE EXCEPTION 'Transaction is already posted';
  END IF;

  -- Get bank account class
  SELECT class INTO v_bank_class
  FROM user_chart_of_accounts WHERE id = v_transaction.bank_account_id;

  -- Category required (except transfers/paired)
  IF v_transaction.type NOT IN ('transfer', 'credit_card_payment')
    AND v_transaction.paired_transfer_id IS NULL
    AND COALESCE(v_transaction.is_transfer_pair, false) = false
    AND v_transaction.is_split = false
    AND v_transaction.category_account_id IS NULL THEN
    IF v_transaction.type = 'income' AND v_bank_class = 'liability' THEN
      RAISE EXCEPTION 'Cannot post credit card payment: must be categorized or marked as a transfer first';
    ELSE
      RAISE EXCEPTION 'Cannot post transaction: category is required';
    END IF;
  END IF;

  -- Find the JE to promote
  v_je_id := COALESCE(v_transaction.current_journal_entry_id, v_transaction.journal_entry_id);

  IF v_je_id IS NULL THEN
    RAISE EXCEPTION 'Transaction has no journal entry. This should not happen — contact support.';
  END IF;

  SELECT * INTO v_je FROM journal_entries WHERE id = v_je_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal entry not found for transaction';
  END IF;

  IF v_je.status = 'locked' THEN
    RAISE EXCEPTION 'Cannot post transaction: the accounting period is locked';
  END IF;

  IF v_je.status = 'voided' THEN
    RAISE EXCEPTION 'Cannot post transaction: journal entry is voided';
  END IF;

  -- Check that no suspense (Uncategorized) line remains
  SELECT id INTO v_suspense_id
  FROM user_chart_of_accounts
  WHERE profile_id = v_transaction.profile_id
    AND account_number = 9999
    AND is_system_account = true
  LIMIT 1;

  IF v_suspense_id IS NOT NULL THEN
    SELECT EXISTS(
      SELECT 1 FROM journal_entry_lines
      WHERE journal_entry_id = v_je_id AND account_id = v_suspense_id
    ) INTO v_has_suspense;

    IF v_has_suspense AND NOT v_transaction.is_split THEN
      RAISE EXCEPTION 'Cannot post transaction: category is required. Assign a category before posting.';
    END IF;
  END IF;

  -- Validate JE is balanced
  SELECT
    COALESCE(SUM(debit_amount), 0),
    COALESCE(SUM(credit_amount), 0)
  INTO v_total_debits, v_total_credits
  FROM journal_entry_lines
  WHERE journal_entry_id = v_je_id;

  IF ABS(v_total_debits - v_total_credits) > 0.01 THEN
    RAISE EXCEPTION 'Journal entry is not balanced (debits: %, credits: %)',
      v_total_debits, v_total_credits;
  END IF;

  -- Capture actor
  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NOT NULL THEN
    SELECT COALESCE(
      NULLIF(TRIM(COALESCE(display_name, '')), ''),
      NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
    )
    INTO v_actor_display_name
    FROM user_settings WHERE id = v_actor_user_id;
  END IF;

  PERFORM set_config('app.actor_user_id', COALESCE(v_actor_user_id::text, ''), true);
  PERFORM set_config('app.actor_display_name', COALESCE(v_actor_display_name, ''), true);
  PERFORM set_config('app.internal_status_write', 'true', true);

  -- Promote JE to posted
  UPDATE journal_entries
  SET
    status = 'posted',
    posted_at = now(),
    posted_by = v_actor_user_id
  WHERE id = v_je_id;

  -- Set transaction to posted
  UPDATE transactions
  SET status = 'posted'
  WHERE id = p_transaction_id
  RETURNING * INTO v_transaction;

  -- Audit log
  INSERT INTO audit_logs (
    profile_id, user_id, actor_display_name, action, entity_type, entity_id,
    description, metadata
  ) VALUES (
    v_transaction.profile_id,
    COALESCE(v_actor_user_id, v_transaction.user_id),
    v_actor_display_name,
    'post_transaction',
    'transaction',
    p_transaction_id,
    v_je.entry_number || ': ' || COALESCE(v_transaction.description, v_transaction.original_description, ''),
    jsonb_build_object(
      'entry_number', v_je.entry_number,
      'journal_entry_id', v_je_id,
      'transaction_id', p_transaction_id,
      'amount', v_transaction.amount
    )
  );

  PERFORM set_config('app.internal_status_write', 'false', true);
  PERFORM set_config('app.actor_user_id', '', true);
  PERFORM set_config('app.actor_display_name', '', true);

  RETURN to_jsonb(v_transaction);

EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.internal_status_write', 'false', true);
  PERFORM set_config('app.actor_user_id', '', true);
  PERFORM set_config('app.actor_display_name', '', true);
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION rpc_post_transaction TO authenticated;
