/*
  # Add entry_type and transaction_date to undo audit log metadata

  ## Problem
  The undo_posted_transaction function didn't store entry_type or transaction_date
  in the audit log metadata. The new two-row undo display needs these to correctly
  reconstruct the original row's type and date.

  ## Changes
  - undo_posted_transaction: captures entry_type and transaction_date into metadata
  - Backfills existing undo audit logs with transaction_date from the transactions table
    (entry_type defaults to 'adjustment' for old records where JE is gone)
*/

CREATE OR REPLACE FUNCTION undo_posted_transaction(p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
  v_transaction_status text;
  v_transaction_date date;
  v_journal_entry_id uuid;
  v_entry_number text;
  v_entry_type text;
  v_entry_description text;
  v_actor_display_name text;
  v_lines_json jsonb;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT
    t.status,
    t.date,
    t.current_journal_entry_id,
    t.profile_id
  INTO
    v_transaction_status,
    v_transaction_date,
    v_journal_entry_id,
    v_profile_id
  FROM transactions t
  WHERE t.id = p_transaction_id
  AND has_profile_access(t.profile_id);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction not found or access denied');
  END IF;

  IF v_transaction_status != 'posted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction is not posted');
  END IF;

  IF v_journal_entry_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No journal entry found for this transaction');
  END IF;

  SELECT entry_number, entry_type, description
  INTO v_entry_number, v_entry_type, v_entry_description
  FROM journal_entries
  WHERE id = v_journal_entry_id;

  -- Capture all journal entry lines before deletion
  SELECT jsonb_agg(jsonb_build_object(
    'account_id', jel.account_id,
    'debit_amount', jel.debit_amount,
    'credit_amount', jel.credit_amount,
    'line_number', jel.line_number
  ) ORDER BY jel.line_number)
  INTO v_lines_json
  FROM journal_entry_lines jel
  WHERE jel.journal_entry_id = v_journal_entry_id;

  SELECT COALESCE(
    NULLIF(TRIM(COALESCE(display_name, '')), ''),
    NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
  )
  INTO v_actor_display_name
  FROM user_settings
  WHERE id = v_user_id;

  INSERT INTO audit_logs (
    profile_id,
    user_id,
    actor_display_name,
    action,
    entity_type,
    entity_id,
    description,
    metadata
  ) VALUES (
    v_profile_id,
    v_user_id,
    v_actor_display_name,
    'undo_transaction',
    'transaction',
    p_transaction_id,
    'Undid posting of ' || v_entry_number ||
    CASE WHEN v_entry_description IS NOT NULL AND v_entry_description != ''
    THEN ': ' || v_entry_description
    ELSE ''
    END,
    jsonb_build_object(
      'entry_number', v_entry_number,
      'entry_type', v_entry_type,
      'entry_description', v_entry_description,
      'transaction_date', v_transaction_date,
      'journal_entry_id', v_journal_entry_id,
      'transaction_id', p_transaction_id,
      'lines', COALESCE(v_lines_json, '[]'::jsonb)
    )
  );

  PERFORM set_config('app.internal_status_write', 'true', true);

  UPDATE transactions
  SET
    status = 'pending',
    current_journal_entry_id = NULL,
    original_journal_entry_id = NULL,
    updated_at = now()
  WHERE id = p_transaction_id
  AND profile_id = v_profile_id;

  PERFORM set_config('app.internal_status_write', 'false', true);

  DELETE FROM journal_entries
  WHERE id = v_journal_entry_id
  AND profile_id = v_profile_id;

  RETURN jsonb_build_object(
    'success', true,
    'entry_number', v_entry_number,
    'message', 'Transaction moved back to pending'
  );
END;
$$;

-- Backfill existing undo logs: add transaction_date from the transactions table
-- entry_type defaults to 'adjustment' since the original JE is gone
DO $$
DECLARE
  r RECORD;
  v_date date;
BEGIN
  FOR r IN
    SELECT al.id, al.entity_id, al.metadata
    FROM audit_logs al
    WHERE al.action = 'undo_transaction'
    AND (al.metadata->>'transaction_date') IS NULL
  LOOP
    SELECT t.date INTO v_date FROM transactions t WHERE t.id = r.entity_id;
    UPDATE audit_logs
    SET metadata = r.metadata
      || jsonb_build_object('transaction_date', v_date)
      || CASE WHEN (r.metadata->>'entry_type') IS NULL
              THEN jsonb_build_object('entry_type', 'adjustment')
              ELSE '{}'::jsonb
         END
    WHERE id = r.id;
  END LOOP;
END $$;
