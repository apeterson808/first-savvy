/*
  # Add Audit Logging to Undo Posted Transaction

  ## Purpose
  When a user undoes a posted transaction, the action was never recorded in audit_logs.
  This meant:
  1. The Audit History tab showed no record of the undo
  2. There was no "By" attribution for who performed the undo

  ## Changes
  - Replace `undo_posted_transaction` to:
    1. Capture the journal entry description and transaction details before deletion
    2. Look up the acting user's display name from user_settings
    3. Insert an audit_log record with action = 'undo_transaction', actor_display_name,
       and metadata containing the entry number, description, and transaction id
    4. Then proceed with the existing logic (clear refs, delete journal entry)

  ## Audit Log Record
  - action: 'undo_transaction'
  - entity_type: 'transaction'
  - entity_id: the transaction id
  - description: 'Undid posting of <entry_number>: <entry_description>'
  - actor_display_name: the user's display_name (or first+last) from user_settings
*/

CREATE OR REPLACE FUNCTION undo_posted_transaction(
  p_transaction_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
  v_transaction_status text;
  v_journal_entry_id uuid;
  v_entry_number text;
  v_entry_description text;
  v_actor_display_name text;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  END IF;

  SELECT
    t.status,
    t.current_journal_entry_id,
    t.profile_id
  INTO
    v_transaction_status,
    v_journal_entry_id,
    v_profile_id
  FROM transactions t
  WHERE t.id = p_transaction_id
    AND t.user_id = v_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Transaction not found or access denied'
    );
  END IF;

  IF v_transaction_status != 'posted' THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Transaction is not posted'
    );
  END IF;

  IF v_journal_entry_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'No journal entry found for this transaction'
    );
  END IF;

  SELECT entry_number, description
  INTO v_entry_number, v_entry_description
  FROM journal_entries
  WHERE id = v_journal_entry_id;

  -- Look up actor display name
  SELECT COALESCE(
    NULLIF(TRIM(COALESCE(display_name, '')), ''),
    NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
  )
  INTO v_actor_display_name
  FROM user_settings
  WHERE id = v_user_id;

  -- Log the undo action to audit history
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
      'entry_description', v_entry_description,
      'journal_entry_id', v_journal_entry_id,
      'transaction_id', p_transaction_id
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
    AND user_id = v_user_id;

  PERFORM set_config('app.internal_status_write', 'false', true);

  DELETE FROM journal_entries
  WHERE id = v_journal_entry_id
    AND user_id = v_user_id
    AND profile_id = v_profile_id;

  RETURN jsonb_build_object(
    'success', true,
    'entry_number', v_entry_number,
    'message', 'Transaction moved back to pending'
  );
END;
$$;
