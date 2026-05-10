/*
  # Fix Undo Posted Transaction for Household Members

  ## Problem
  `undo_posted_transaction` uses `AND t.user_id = auth.uid()` to find the transaction
  and `AND user_id = v_user_id` on the UPDATE/DELETE. This means only the profile
  owner can undo transactions — household members like Jenna get a 403 because their
  auth.uid() doesn't match the transaction's user_id (which is the owner's ID).

  ## Fix
  Replace `user_id = v_user_id` access checks with `has_profile_access(profile_id)`,
  the standard pattern used throughout the codebase for household member access.
  UPDATE and DELETE are scoped by `profile_id = v_profile_id` instead of user_id.
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
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Use has_profile_access() so household members (not just the owner) can undo
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
