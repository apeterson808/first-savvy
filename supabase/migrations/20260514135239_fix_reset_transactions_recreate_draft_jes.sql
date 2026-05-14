/*
  # Fix reset_transactions_to_pending to recreate draft JEs

  ## Problem
  After reset, all transactions are pending but have no journal entry (journal_entry_id = NULL).
  rpc_post_transaction requires a draft JE to exist — without one it throws
  "Transaction has no journal entry. This should not happen — contact support."

  ## Fix
  1. Extract draft JE creation into a reusable function: backfill_draft_jes_for_profile()
  2. Call it at the end of reset_transactions_to_pending so every pending transaction
     immediately gets a fresh draft JE pointing to suspense (account 9999) or its
     category account.
*/

-- Reusable function: create draft JEs for all pending transactions without one
CREATE OR REPLACE FUNCTION backfill_draft_jes_for_profile(p_profile_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx             record;
  v_je_id          uuid;
  v_entry_number   text;
  v_suspense_id    uuid;
  v_category_id    uuid;
  v_bank_class     text;
  v_bank_is_debit  boolean;
  v_amount         numeric;
  v_description    text;
  v_entry_type     text;
  v_count          integer := 0;
BEGIN
  FOR v_tx IN
    SELECT t.*
    FROM transactions t
    WHERE t.profile_id = p_profile_id
      AND t.status = 'pending'
      AND t.journal_entry_id IS NULL
      AND t.bank_account_id IS NOT NULL
      AND ABS(COALESCE(t.amount, 0)) > 0
  LOOP
    v_amount      := ABS(v_tx.amount);
    v_description := COALESCE(v_tx.description, v_tx.original_description, '');

    -- Get next JE number
    v_entry_number := get_next_je_number(v_tx.profile_id);

    -- Get bank account class
    SELECT class INTO v_bank_class
    FROM user_chart_of_accounts WHERE id = v_tx.bank_account_id;

    IF v_bank_class IS NULL THEN
      CONTINUE;
    END IF;

    -- Map transaction type → entry_type
    v_entry_type := CASE v_tx.type
      WHEN 'transfer' THEN 'transfer'
      WHEN 'income'   THEN 'deposit'
      WHEN 'expense'  THEN
        CASE v_bank_class
          WHEN 'liability' THEN 'charge'
          ELSE 'withdrawal'
        END
      ELSE 'adjustment'
    END;

    -- Create draft JE
    INSERT INTO journal_entries (
      profile_id, user_id, entry_number, entry_date,
      description, status, entry_type, created_by_user_id
    ) VALUES (
      v_tx.profile_id, v_tx.user_id, v_entry_number,
      COALESCE(v_tx.date, CURRENT_DATE),
      v_description, 'draft', v_entry_type, v_tx.user_id
    ) RETURNING id INTO v_je_id;

    -- Determine bank debit/credit direction
    v_bank_is_debit := get_je_debit_side_for_bank(
      v_bank_class, COALESCE(v_tx.type, 'expense'), v_tx.amount
    );

    -- Category side: use assigned category or suspense (9999)
    v_category_id := v_tx.category_account_id;
    IF v_category_id IS NULL THEN
      SELECT id INTO v_suspense_id
      FROM user_chart_of_accounts
      WHERE profile_id = v_tx.profile_id
        AND account_number = 9999
        AND is_system_account = true
      LIMIT 1;
      v_category_id := v_suspense_id;
    END IF;

    IF v_category_id IS NOT NULL THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id, line_number,
        debit_amount, credit_amount, description
      ) VALUES (
        v_je_id, v_tx.profile_id, v_tx.user_id, v_category_id, 1,
        CASE WHEN NOT v_bank_is_debit THEN v_amount ELSE NULL END,
        CASE WHEN v_bank_is_debit     THEN v_amount ELSE NULL END,
        v_description
      );
    END IF;

    -- Bank line
    INSERT INTO journal_entry_lines (
      journal_entry_id, profile_id, user_id, account_id, line_number,
      debit_amount, credit_amount, description
    ) VALUES (
      v_je_id, v_tx.profile_id, v_tx.user_id, v_tx.bank_account_id, 2,
      CASE WHEN v_bank_is_debit     THEN v_amount ELSE NULL END,
      CASE WHEN NOT v_bank_is_debit THEN v_amount ELSE NULL END,
      v_description
    );

    -- Link JE to transaction
    UPDATE transactions
    SET
      journal_entry_id          = v_je_id,
      current_journal_entry_id  = v_je_id,
      original_journal_entry_id = v_je_id
    WHERE id = v_tx.id;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION backfill_draft_jes_for_profile TO authenticated;


-- Update reset_transactions_to_pending to recreate draft JEs after clearing
CREATE OR REPLACE FUNCTION reset_transactions_to_pending(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transactions_reset int := 0;
  v_jes_created        int := 0;
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
    status                     = 'pending',
    journal_entry_id           = NULL,
    current_journal_entry_id   = NULL,
    original_journal_entry_id  = NULL,
    category_account_id        = NULL,
    contact_id                 = NULL,
    contact_manually_set       = false,
    applied_rule_id            = NULL,
    type                       = COALESCE(original_type, type)
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

  -- Recreate fresh draft JEs for all pending transactions
  v_jes_created := backfill_draft_jes_for_profile(p_profile_id);

  RETURN jsonb_build_object(
    'success', true,
    'transactions_reset', v_transactions_reset,
    'draft_jes_created', v_jes_created
  );

EXCEPTION
  WHEN OTHERS THEN
    PERFORM set_config('app.internal_status_write', 'false', true);
    RAISE;
END;
$$;

GRANT EXECUTE ON FUNCTION reset_transactions_to_pending TO authenticated;
