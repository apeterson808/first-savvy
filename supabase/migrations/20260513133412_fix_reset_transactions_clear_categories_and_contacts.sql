/*
  # Fix reset_transactions_to_pending to also clear categories and contacts

  When resetting transactions to pending, also clear:
  - category_account_id (the expense/income category)
  - contact_id
  - contact_manually_set
  - applied_rule_id
  - type (revert back to original_type if set)

  This ensures transactions are fully reset to their raw imported state.
*/

CREATE OR REPLACE FUNCTION reset_transactions_to_pending(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_transactions_reset int := 0;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = p_profile_id
  ) THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF NOT has_profile_access(p_profile_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  PERFORM set_config('app.internal_status_write', 'true', true);

  -- Delete transaction splits first (FK dependency)
  DELETE FROM transaction_splits
  WHERE transaction_id IN (
    SELECT id FROM transactions WHERE profile_id = p_profile_id
  );

  -- Reset all transactions to pending, clear all enrichment fields
  UPDATE transactions
  SET
    status = 'pending',
    journal_entry_id = NULL,
    current_journal_entry_id = NULL,
    original_journal_entry_id = NULL,
    category_account_id = NULL,
    contact_id = NULL,
    contact_manually_set = false,
    applied_rule_id = NULL,
    type = COALESCE(original_type, type)
  WHERE profile_id = p_profile_id
    AND status IN ('posted', 'pending');
  GET DIAGNOSTICS v_transactions_reset = ROW_COUNT;

  -- Delete journal entry lines for non-opening-balance entries
  DELETE FROM journal_entry_lines
  WHERE profile_id = p_profile_id
    AND journal_entry_id IN (
      SELECT id FROM journal_entries
      WHERE profile_id = p_profile_id
        AND entry_type != 'opening_balance'
    );

  -- Delete all non-opening-balance journal entries
  DELETE FROM journal_entries
  WHERE profile_id = p_profile_id
    AND entry_type != 'opening_balance';

  -- Reset all journal entry counters
  DELETE FROM journal_entry_counters
  WHERE profile_id = p_profile_id;

  -- Clear audit logs for this profile
  DELETE FROM audit_logs
  WHERE profile_id = p_profile_id;

  PERFORM set_config('app.internal_status_write', 'false', true);

  RETURN jsonb_build_object(
    'success', true,
    'transactions_reset', v_transactions_reset
  );

EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('app.internal_status_write', 'false', true);
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION reset_transactions_to_pending TO authenticated;
