/*
  # Backfill draft JEs for orphaned pending transactions

  ## Problem
  26 pending transactions have journal_entry_id = NULL and
  current_journal_entry_id = NULL — they have no draft JE. These were left
  orphaned by the old undo_posted_transaction (which deleted JEs). They cannot
  be posted because rpc_post_transaction requires a JE.

  ## Fix
  Create a draft JE for each orphaned pending transaction using the same
  entry_type mapping as the create_draft_je_on_transaction_insert trigger:
    income   → 'deposit'
    expense  → 'withdrawal' (asset bank) or 'charge' (liability bank)
    transfer → 'transfer'
    other    → 'adjustment'
*/

DO $$
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
BEGIN
  FOR v_tx IN
    SELECT t.*
    FROM transactions t
    WHERE t.status = 'pending'
      AND t.journal_entry_id IS NULL
      AND t.current_journal_entry_id IS NULL
      AND t.bank_account_id IS NOT NULL
      AND ABS(COALESCE(t.amount, 0)) > 0
  LOOP
    v_amount      := ABS(v_tx.amount);
    v_description := COALESCE(v_tx.description, v_tx.original_description, '');

    -- Get next JE number
    INSERT INTO journal_entry_sequences (profile_id, last_number)
    VALUES (v_tx.profile_id, 1)
    ON CONFLICT (profile_id) DO UPDATE
      SET last_number = journal_entry_sequences.last_number + 1
    RETURNING 'JE-' || LPAD(last_number::text, 4, '0') INTO v_entry_number;

    -- Get bank account class
    SELECT class INTO v_bank_class
    FROM user_chart_of_accounts WHERE id = v_tx.bank_account_id;

    IF v_bank_class IS NULL THEN
      CONTINUE;
    END IF;

    -- Map transaction type → entry_type (matching the INSERT trigger)
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
      journal_entry_id             = v_je_id,
      current_journal_entry_id     = v_je_id,
      original_journal_entry_id    = v_je_id
    WHERE id = v_tx.id;

  END LOOP;
END $$;
