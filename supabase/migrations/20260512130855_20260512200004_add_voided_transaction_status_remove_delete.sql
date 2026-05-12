/*
  # Add voided transaction status, remove DELETE permission, add delete-prevention trigger

  ## Changes
  - Adds 'voided' as a valid transaction status
  - Drops the DELETE RLS policy on transactions table
  - Adds a trigger that raises an exception if a DELETE is attempted on transactions
  - Transactions can only be voided, never deleted

  ## Rationale
  Transactions represent a permanent record of financial activity. They should never
  be deleted. Instead they can be voided which sets status='voided' and voids the
  linked journal entry. The record remains in the register with a voided indicator.
*/

-- Update status CHECK constraint on transactions to include 'voided'
DO $$
BEGIN
  ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
  ALTER TABLE transactions ADD CONSTRAINT transactions_status_check
    CHECK (status IN ('pending', 'posted', 'voided'));
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Drop the DELETE RLS policy
DROP POLICY IF EXISTS "Users can delete transactions in their profiles" ON transactions;

-- Add trigger to prevent hard deletes at the DB level
CREATE OR REPLACE FUNCTION prevent_transaction_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Transactions cannot be deleted. Use void_transaction() to void a transaction instead.';
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS prevent_transaction_delete_trigger ON transactions;
CREATE TRIGGER prevent_transaction_delete_trigger
  BEFORE DELETE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION prevent_transaction_delete();

-- Function to void a transaction (replaces delete)
CREATE OR REPLACE FUNCTION void_transaction(p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction record;
  v_paired_id uuid;
BEGIN
  SELECT t.*, t.profile_id as t_profile_id
  INTO v_transaction
  FROM transactions t
  WHERE t.id = p_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found';
  END IF;

  IF NOT has_profile_access(v_transaction.profile_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF v_transaction.status = 'voided' THEN
    RAISE EXCEPTION 'Transaction is already voided';
  END IF;

  -- Check if this is part of a transfer pair — unpair first
  IF v_transaction.paired_transfer_id IS NOT NULL THEN
    v_paired_id := v_transaction.paired_transfer_id;

    -- Clear the pairing on both sides
    PERFORM set_config('app.internal_status_write', 'true', true);
    
    UPDATE transactions
    SET paired_transfer_id = NULL, is_transfer_pair = false
    WHERE id IN (p_transaction_id, v_paired_id);
  END IF;

  PERFORM set_config('app.internal_status_write', 'true', true);

  -- Void the transaction
  UPDATE transactions
  SET status = 'voided'
  WHERE id = p_transaction_id;

  -- Void the linked journal entry if it exists
  IF v_transaction.journal_entry_id IS NOT NULL THEN
    UPDATE journal_entries
    SET
      status = 'voided',
      voided_at = now(),
      void_reason = 'user_voided'
    WHERE id = v_transaction.journal_entry_id;
  END IF;

  IF v_transaction.current_journal_entry_id IS NOT NULL
    AND v_transaction.current_journal_entry_id != v_transaction.journal_entry_id THEN
    UPDATE journal_entries
    SET
      status = 'voided',
      voided_at = now(),
      void_reason = 'user_voided'
    WHERE id = v_transaction.current_journal_entry_id;
  END IF;

  -- Log the void action
  INSERT INTO audit_logs (
    profile_id, user_id, action, entity_type, entity_id, description, metadata
  ) VALUES (
    v_transaction.profile_id,
    auth.uid(),
    'void_transaction',
    'transaction',
    p_transaction_id,
    'Transaction voided: ' || COALESCE(v_transaction.description, v_transaction.original_description, ''),
    jsonb_build_object(
      'transaction_id', p_transaction_id,
      'previous_status', v_transaction.status,
      'journal_entry_id', v_transaction.journal_entry_id
    )
  );

  PERFORM set_config('app.internal_status_write', 'false', true);

  RETURN jsonb_build_object('success', true, 'transaction_id', p_transaction_id);

EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.internal_status_write', 'false', true);
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION void_transaction TO authenticated;
