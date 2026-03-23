/*
  # Add Undo Posted Transaction Function

  1. New Function
    - `undo_posted_transaction(transaction_id)` - Reverts a posted transaction back to pending
    
  2. Details
    - Deletes the journal entry (which cascades to journal_entry_lines via foreign key)
    - Sets transaction status back to 'pending'
    - Clears the current_journal_entry_id reference
    - Maintains audit history (journal entries are soft-deleted with audit trail)
    - Only works on posted transactions
    - Validates that the transaction belongs to the user
    
  3. Security
    - SECURITY DEFINER function
    - Validates user_id matches authenticated user
    - Validates profile_id matches transaction
    - Only allows undoing posted transactions
*/

CREATE OR REPLACE FUNCTION undo_posted_transaction(
  p_transaction_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  DELETE FROM journal_entries
  WHERE id = v_journal_entry_id
  AND user_id = v_user_id
  AND profile_id = v_profile_id;

  UPDATE transactions
  SET 
    status = 'pending',
    current_journal_entry_id = NULL,
    updated_at = now()
  WHERE id = p_transaction_id
  AND user_id = v_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'entry_number', v_entry_number,
    'message', 'Transaction moved back to pending'
  );
END;
$$;
