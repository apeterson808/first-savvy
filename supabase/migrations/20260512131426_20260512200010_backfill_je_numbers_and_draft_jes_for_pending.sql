/*
  # Backfill: renumber JEs to JE-XXXX and create draft JEs for pending transactions

  ## Steps
  1. Seed journal_entry_sequences for all profiles with current JE count
  2. Renumber existing journal entries (OB-XXXX etc.) to JE-XXXX format
     in chronological order per profile
  3. Create draft JEs for all existing pending transactions that don't have one
  4. Update audit_logs to reflect new entry numbers

  ## Data Safety
  - Uses IF NOT EXISTS / ON CONFLICT patterns throughout
  - Opening balance entries get JE numbers just like everything else
  - entry_type field preserved for filtering/display
*/

DO $$
DECLARE
  v_profile record;
  v_je record;
  v_tx record;
  v_je_id uuid;
  v_entry_number text;
  v_seq integer;
  v_bank_class text;
  v_category_class text;
  v_suspense_id uuid;
  v_offset_account_id uuid;
  v_amount numeric;
  v_bank_is_debit boolean;
BEGIN
  -- Step 1: For each profile that has journal entries, seed the sequence
  -- starting from 0 so renumbering starts at JE-0001
  FOR v_profile IN
    SELECT DISTINCT profile_id FROM journal_entries
  LOOP
    INSERT INTO journal_entry_sequences (profile_id, last_number)
    VALUES (v_profile.profile_id, 0)
    ON CONFLICT (profile_id) DO NOTHING;
  END LOOP;

  -- Also seed for profiles with pending transactions
  FOR v_profile IN
    SELECT DISTINCT profile_id FROM transactions WHERE status = 'pending'
  LOOP
    INSERT INTO journal_entry_sequences (profile_id, last_number)
    VALUES (v_profile.profile_id, 0)
    ON CONFLICT (profile_id) DO NOTHING;
  END LOOP;

  -- Step 2: Renumber existing journal entries chronologically per profile
  FOR v_profile IN
    SELECT DISTINCT profile_id FROM journal_entries
  LOOP
    v_seq := 0;
    FOR v_je IN
      SELECT id, entry_number FROM journal_entries
      WHERE profile_id = v_profile.profile_id
      ORDER BY entry_date ASC, created_at ASC
    LOOP
      v_seq := v_seq + 1;
      v_entry_number := 'JE-' || LPAD(v_seq::text, 4, '0');

      -- Update JE number
      UPDATE journal_entries
      SET entry_number = v_entry_number
      WHERE id = v_je.id;

      -- Update audit_logs that reference the old entry number
      UPDATE audit_logs
      SET
        description = v_entry_number || SUBSTRING(description FROM POSITION(': ' IN description)),
        metadata = metadata || jsonb_build_object('entry_number', v_entry_number)
      WHERE (metadata->>'journal_entry_id')::uuid = v_je.id
        AND action = 'post_transaction';
    END LOOP;

    -- Update the sequence to the highest number used
    UPDATE journal_entry_sequences
    SET last_number = v_seq, updated_at = now()
    WHERE profile_id = v_profile.profile_id;
  END LOOP;

  -- Step 3: Create draft JEs for all pending transactions without a JE
  FOR v_tx IN
    SELECT * FROM transactions
    WHERE status = 'pending'
      AND journal_entry_id IS NULL
      AND bank_account_id IS NOT NULL
      AND ABS(COALESCE(amount, 0)) > 0
    ORDER BY profile_id, date ASC, created_at ASC
  LOOP
    v_amount := ABS(v_tx.amount);

    -- Get bank class
    SELECT class INTO v_bank_class
    FROM user_chart_of_accounts WHERE id = v_tx.bank_account_id;

    IF v_bank_class IS NULL THEN
      CONTINUE;
    END IF;

    -- Find suspense account
    SELECT id INTO v_suspense_id
    FROM user_chart_of_accounts
    WHERE profile_id = v_tx.profile_id
      AND account_number = 9999
      AND is_system_account = true
    LIMIT 1;

    -- Determine offset account
    IF v_tx.category_account_id IS NOT NULL THEN
      v_offset_account_id := v_tx.category_account_id;
      SELECT class INTO v_category_class
      FROM user_chart_of_accounts WHERE id = v_tx.category_account_id;
    ELSIF v_suspense_id IS NOT NULL THEN
      v_offset_account_id := v_suspense_id;
      v_category_class := 'expense';
    ELSE
      CONTINUE;
    END IF;

    -- Get next JE number
    v_entry_number := get_next_je_number(v_tx.profile_id);

    -- Determine bank side direction
    v_bank_is_debit := get_je_debit_side_for_bank(
      v_bank_class,
      COALESCE(v_tx.type, 'expense'),
      v_tx.amount
    );

    -- Create draft JE
    INSERT INTO journal_entries (
      profile_id, user_id, entry_date, entry_number, description,
      entry_type, source, status
    ) VALUES (
      v_tx.profile_id,
      v_tx.user_id,
      v_tx.date,
      v_entry_number,
      COALESCE(v_tx.description, v_tx.original_description, ''),
      CASE v_tx.type
        WHEN 'transfer' THEN 'transfer'
        WHEN 'income'   THEN 'deposit'
        WHEN 'expense'  THEN
          CASE v_bank_class
            WHEN 'liability' THEN 'charge'
            ELSE 'withdrawal'
          END
        ELSE 'adjustment'
      END,
      CASE
        WHEN v_tx.source = 'import' THEN 'import'
        WHEN v_tx.source = 'manual' THEN 'manual'
        ELSE 'system'
      END,
      'draft'
    )
    RETURNING id INTO v_je_id;

    -- Category / suspense line
    IF v_category_class IN ('expense', 'asset') THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id, line_number, debit_amount, description
      ) VALUES (
        v_je_id, v_tx.profile_id, v_tx.user_id,
        v_offset_account_id, 1, v_amount,
        COALESCE(v_tx.description, v_tx.original_description, '')
      );
    ELSE
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id, line_number, credit_amount, description
      ) VALUES (
        v_je_id, v_tx.profile_id, v_tx.user_id,
        v_offset_account_id, 1, v_amount,
        COALESCE(v_tx.description, v_tx.original_description, '')
      );
    END IF;

    -- Bank line
    IF v_bank_is_debit THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id, line_number, debit_amount, description
      ) VALUES (
        v_je_id, v_tx.profile_id, v_tx.user_id,
        v_tx.bank_account_id, 2, v_amount,
        COALESCE(v_tx.description, v_tx.original_description, '')
      );
    ELSE
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id, line_number, credit_amount, description
      ) VALUES (
        v_je_id, v_tx.profile_id, v_tx.user_id,
        v_tx.bank_account_id, 2, v_amount,
        COALESCE(v_tx.description, v_tx.original_description, '')
      );
    END IF;

    -- Link JE to transaction
    UPDATE transactions
    SET
      journal_entry_id = v_je_id,
      current_journal_entry_id = v_je_id,
      original_journal_entry_id = COALESCE(original_journal_entry_id, v_je_id)
    WHERE id = v_tx.id;

  END LOOP;

END $$;
