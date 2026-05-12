/*
  # Update reset_transactions_to_pending to restore draft JEs

  ## Changes
  Instead of deleting all non-opening-balance JEs, this function now:
  - Sets all posted transactions back to 'pending'
  - Restores all posted (non-OB, non-voided) JEs back to 'draft' status
  - Replaces category lines on those JEs with the suspense account (Uncategorized)
    if the transaction no longer has a category (since we're resetting to pending)
  - Keeps the JE record, its entry number, and its structure intact
  - Clears audit logs for the profile (same as before)

  ## What is preserved
  - All transactions (pending again)
  - All journal entries (draft again, category lines may be replaced with suspense)
  - Opening balance JEs (status unchanged)
  - Chart of accounts, rules, budgets, contacts
  - Journal entry numbers (no renumbering)

  ## Note on journal_entry_sequences
  The sequence is NOT reset. JE numbers already issued are permanent.
*/

CREATE OR REPLACE FUNCTION reset_transactions_to_pending(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transactions_reset int := 0;
  v_jes_reset int := 0;
  v_suspense_id uuid;
  v_je record;
  v_tx record;
  v_bank_class text;
  v_category_class text;
  v_amount numeric;
  v_bank_is_debit boolean;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id) THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF NOT has_profile_access(p_profile_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  PERFORM set_config('app.internal_status_write', 'true', true);

  -- Find suspense account for this profile
  SELECT id INTO v_suspense_id
  FROM user_chart_of_accounts
  WHERE profile_id = p_profile_id
    AND account_number = 9999
    AND is_system_account = true
  LIMIT 1;

  -- Step 1: Delete transaction splits
  DELETE FROM transaction_splits
  WHERE transaction_id IN (
    SELECT id FROM transactions WHERE profile_id = p_profile_id
  );

  -- Step 2: Reset all posted transactions to pending, clear current JE pointer
  -- (journal_entry_id stays so we can find the JE to reset)
  UPDATE transactions
  SET
    status = 'pending',
    category_account_id = category_account_id, -- keep the category, JE will be updated
    current_journal_entry_id = journal_entry_id -- reset current to original
  WHERE profile_id = p_profile_id
    AND status = 'posted';
  GET DIAGNOSTICS v_transactions_reset = ROW_COUNT;

  -- Step 3: For each non-OB, non-voided JE in this profile:
  --   - Set status back to 'draft'
  --   - Restore category lines (keep what's there, suspense already in place for uncategorized)
  FOR v_je IN
    SELECT je.id, je.entry_type
    FROM journal_entries je
    WHERE je.profile_id = p_profile_id
      AND je.entry_type != 'opening_balance'
      AND je.status NOT IN ('voided')
  LOOP
    UPDATE journal_entries
    SET
      status = 'draft',
      posted_at = NULL,
      posted_by = NULL
    WHERE id = v_je.id;

    v_jes_reset := v_jes_reset + 1;
  END LOOP;

  -- Step 4: For any transaction that has a JE but no category, ensure the JE
  -- uses the suspense account as the non-bank line
  IF v_suspense_id IS NOT NULL THEN
    FOR v_tx IN
      SELECT t.*
      FROM transactions t
      WHERE t.profile_id = p_profile_id
        AND t.status = 'pending'
        AND t.category_account_id IS NULL
        AND t.journal_entry_id IS NOT NULL
        AND t.bank_account_id IS NOT NULL
    LOOP
      v_amount := ABS(v_tx.amount);
      SELECT class INTO v_bank_class FROM user_chart_of_accounts WHERE id = v_tx.bank_account_id;

      v_bank_is_debit := get_je_debit_side_for_bank(
        v_bank_class, COALESCE(v_tx.type, 'expense'), v_tx.amount
      );

      -- Replace non-bank lines with suspense
      DELETE FROM journal_entry_lines
      WHERE journal_entry_id = v_tx.journal_entry_id
        AND account_id != v_tx.bank_account_id;

      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id, line_number, debit_amount, description
      ) VALUES (
        v_tx.journal_entry_id, p_profile_id, v_tx.user_id,
        v_suspense_id, 1, v_amount,
        COALESCE(v_tx.description, v_tx.original_description, '')
      );
    END LOOP;
  END IF;

  -- Step 5: Clear audit logs for this profile
  DELETE FROM audit_logs WHERE profile_id = p_profile_id;

  PERFORM set_config('app.internal_status_write', 'false', true);

  RETURN jsonb_build_object(
    'success', true,
    'transactions_reset', v_transactions_reset,
    'journal_entries_reset', v_jes_reset
  );

EXCEPTION WHEN OTHERS THEN
  PERFORM set_config('app.internal_status_write', 'false', true);
  RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION reset_transactions_to_pending TO authenticated;
