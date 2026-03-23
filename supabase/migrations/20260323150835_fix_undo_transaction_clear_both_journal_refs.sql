/*
  # Fix Undo Transaction to Clear Both Journal Entry References

  1. Changes
    - Update `undo_posted_transaction` function to clear both `current_journal_entry_id` 
      and `original_journal_entry_id` before deleting the journal entry
    - This prevents foreign key constraint violations when the original_journal_entry_id 
      still references the entry we're trying to delete

  2. Notes
    - The function already had permission via session flag to update status
    - Now it also clears both journal entry references to allow safe deletion
    - This fixes the error: "violates foreign key constraint transactions_original_journal_entry_id_fkey"
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

  SELECT entry_number INTO v_entry_number
  FROM journal_entries
  WHERE id = v_journal_entry_id;

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
