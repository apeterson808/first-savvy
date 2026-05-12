/*
  # Create reset_transactions_to_pending function

  ## Summary
  Adds a new function that moves all posted transactions back to pending status,
  keeping opening balance journal entries intact, and clears all other journal
  entries, journal entry lines, counters, audit logs, and transaction splits.

  ## What is reset
  - All transactions: status set back to 'pending', journal entry references cleared
  - transaction_splits: deleted
  - journal_entries: all deleted except those with entry_type = 'opening_balance'
  - journal_entry_lines: deleted for all non-opening-balance entries
  - journal_entry_counters: all counters reset (deleted) for this profile
  - audit_logs: all cleared for this profile

  ## What is preserved
  - Transactions themselves (just moved back to pending)
  - Opening balance journal entries and their lines
  - user_chart_of_accounts (all accounts)
  - transaction_rules, transaction_categorization_memory
  - budgets, contacts, everything else
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
  -- Verify the caller has access to this profile
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
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Reset all transactions to pending, clear journal entry references
  UPDATE transactions
  SET
    status = 'pending',
    journal_entry_id = NULL,
    current_journal_entry_id = NULL,
    original_journal_entry_id = NULL
  WHERE profile_id = p_profile_id
    AND status = 'posted';
  GET DIAGNOSTICS v_transactions_reset = ROW_COUNT;

  -- Delete journal entry lines for non-opening-balance entries
  DELETE FROM journal_entry_lines
  WHERE profile_id = p_profile_id
    AND journal_entry_id IN (
      SELECT id FROM journal_entries
      WHERE profile_id = p_profile_id
        AND entry_type != 'opening_balance'
    );
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Delete all non-opening-balance journal entries
  DELETE FROM journal_entries
  WHERE profile_id = p_profile_id
    AND entry_type != 'opening_balance';
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Reset all journal entry counters (new transactions will start fresh)
  DELETE FROM journal_entry_counters
  WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  -- Clear audit logs for this profile
  DELETE FROM audit_logs
  WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

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
