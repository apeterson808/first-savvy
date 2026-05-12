/*
  # Fix liability entry_type: use transaction.type instead of amount sign

  ## Problem
  The trigger uses `NEW.amount < 0` to detect a credit card charge, but transaction
  amounts are stored as positive numbers. This means liability transactions always
  fall through to 'payment' even when they are purchases (charges).

  ## Fix
  For liability accounts, use transaction.type:
  - type = 'expense'  → charge  (buying something on the card)
  - type = 'income'   → payment (paying off the card or receiving a credit)
  - type = 'transfer' → transfer

  For asset/bank accounts, amount sign still works (imports use negative for withdrawals).
  For expense accounts, type = 'expense' → expense, type = 'income' → refund.

  Also re-backfills existing posted transactions with this corrected logic.
*/

-- Step 1: Update the trigger function
CREATE OR REPLACE FUNCTION auto_create_journal_entry_from_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_journal_entry_id uuid;
  v_entry_number text;
  v_line_number integer := 1;
  v_category_account_class text;
  v_bank_account_class text;
  v_split_count integer;
  v_split_record record;
  v_split_total_abs numeric := 0;
  v_total_split_debits numeric := 0;
  v_total_split_credits numeric := 0;
  v_bank_offset_amount numeric;
  v_counter_entry_type text;
  v_je_entry_type text;
  v_actor_user_id uuid;
  v_actor_display_name text;
BEGIN
  IF NEW.status != 'posted' OR NEW.category_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.journal_entry_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT class INTO v_bank_account_class
  FROM user_chart_of_accounts WHERE id = NEW.bank_account_id;

  SELECT class INTO v_category_account_class
  FROM user_chart_of_accounts WHERE id = NEW.category_account_id;

  IF NEW.type = 'transfer' THEN
    v_counter_entry_type := 'transfer';
    v_je_entry_type      := 'transfer';
  ELSE
    v_je_entry_type := CASE
      WHEN v_bank_account_class IN ('asset', 'bank') THEN
        CASE WHEN NEW.amount >= 0 THEN 'deposit' ELSE 'withdrawal' END
      WHEN v_bank_account_class = 'liability' THEN
        -- Use transaction type: expense = charge (buying), income = payment (paying off)
        CASE WHEN NEW.type = 'expense' THEN 'charge' ELSE 'payment' END
      WHEN v_bank_account_class = 'expense' THEN
        CASE WHEN NEW.type = 'expense' THEN 'expense' ELSE 'refund' END
      ELSE 'adjustment'
    END;
    v_counter_entry_type := v_je_entry_type;
  END IF;

  v_entry_number := generate_journal_entry_number(NEW.profile_id, v_counter_entry_type);

  INSERT INTO journal_entries (
    profile_id, user_id, entry_date, entry_number, description, entry_type, source
  ) VALUES (
    NEW.profile_id, NEW.user_id, NEW.date, v_entry_number,
    COALESCE(NEW.description, NEW.original_description),
    v_je_entry_type,
    CASE
      WHEN NEW.source = 'import' THEN 'import'
      WHEN NEW.source = 'manual' THEN 'manual'
      ELSE 'system'
    END
  )
  RETURNING id INTO v_journal_entry_id;

  SELECT class INTO v_bank_account_class
  FROM user_chart_of_accounts WHERE id = NEW.bank_account_id;

  SELECT class INTO v_category_account_class
  FROM user_chart_of_accounts WHERE id = NEW.category_account_id;

  SELECT COUNT(*) INTO v_split_count
  FROM transaction_splits WHERE transaction_id = NEW.id;

  IF v_split_count = 0 THEN
    IF v_category_account_class IN ('expense', 'asset') THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id, line_number, debit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.category_account_id,
        v_line_number, ABS(NEW.amount), COALESCE(NEW.description, NEW.original_description)
      );
    ELSE
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id, line_number, credit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.category_account_id,
        v_line_number, ABS(NEW.amount), COALESCE(NEW.description, NEW.original_description)
      );
    END IF;

    v_line_number := v_line_number + 1;

    IF v_category_account_class IN ('expense', 'asset') THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id, line_number, credit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.bank_account_id,
        v_line_number, ABS(NEW.amount), COALESCE(NEW.description, NEW.original_description)
      );
    ELSE
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id, line_number, debit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.bank_account_id,
        v_line_number, ABS(NEW.amount), COALESCE(NEW.description, NEW.original_description)
      );
    END IF;

  ELSE
    FOR v_split_record IN
      SELECT * FROM transaction_splits WHERE transaction_id = NEW.id ORDER BY split_number
    LOOP
      SELECT class INTO v_category_account_class
      FROM user_chart_of_accounts WHERE id = v_split_record.category_account_id;

      v_split_total_abs := v_split_total_abs + ABS(v_split_record.amount);

      IF v_category_account_class IN ('expense', 'asset') THEN
        INSERT INTO journal_entry_lines (
          journal_entry_id, profile_id, user_id, account_id, line_number, debit_amount, description
        ) VALUES (
          v_journal_entry_id, NEW.profile_id, NEW.user_id, v_split_record.category_account_id,
          v_line_number, ABS(v_split_record.amount), v_split_record.description
        );
        v_total_split_debits := v_total_split_debits + ABS(v_split_record.amount);
      ELSE
        INSERT INTO journal_entry_lines (
          journal_entry_id, profile_id, user_id, account_id, line_number, credit_amount, description
        ) VALUES (
          v_journal_entry_id, NEW.profile_id, NEW.user_id, v_split_record.category_account_id,
          v_line_number, ABS(v_split_record.amount), v_split_record.description
        );
        v_total_split_credits := v_total_split_credits + ABS(v_split_record.amount);
      END IF;

      v_line_number := v_line_number + 1;
    END LOOP;

    v_bank_offset_amount := v_total_split_debits - v_total_split_credits;

    IF ABS(v_split_total_abs - ABS(NEW.amount)) > 0.01 THEN
      RAISE EXCEPTION 'Split totals ($%) do not match transaction amount ($%). Difference: $%',
        v_split_total_abs, ABS(NEW.amount), ABS(v_split_total_abs - ABS(NEW.amount));
    END IF;

    IF ABS(v_bank_offset_amount) < 0.01 THEN
      RAISE EXCEPTION 'Bank offset amount is zero. Split debits ($%) equal split credits ($%)',
        v_total_split_debits, v_total_split_credits;
    END IF;

    IF v_bank_offset_amount > 0 THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id, line_number, credit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.bank_account_id,
        v_line_number, ABS(v_bank_offset_amount), COALESCE(NEW.description, NEW.original_description)
      );
    ELSE
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id, line_number, debit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.bank_account_id,
        v_line_number, ABS(v_bank_offset_amount), COALESCE(NEW.description, NEW.original_description)
      );
    END IF;
  END IF;

  NEW.journal_entry_id := v_journal_entry_id;
  NEW.current_journal_entry_id := v_journal_entry_id;

  IF NEW.original_journal_entry_id IS NULL THEN
    NEW.original_journal_entry_id := v_journal_entry_id;
  END IF;

  BEGIN
    v_actor_user_id := NULLIF(current_setting('app.actor_user_id', true), '')::uuid;
  EXCEPTION WHEN OTHERS THEN
    v_actor_user_id := NULL;
  END;
  v_actor_display_name := NULLIF(current_setting('app.actor_display_name', true), '');

  INSERT INTO audit_logs (
    profile_id, user_id, actor_display_name, action, entity_type, entity_id, description, metadata
  ) VALUES (
    NEW.profile_id,
    COALESCE(v_actor_user_id, NEW.user_id),
    v_actor_display_name,
    'post_transaction',
    'transaction',
    NEW.id,
    v_entry_number || ': ' || COALESCE(NEW.description, NEW.original_description, ''),
    jsonb_build_object(
      'entry_number', v_entry_number,
      'journal_entry_id', v_journal_entry_id,
      'transaction_id', NEW.id,
      'amount', NEW.amount
    )
  );

  RETURN NEW;
END;
$$;

-- Step 2: Re-backfill entry_type for all existing posted transactions using corrected logic
UPDATE journal_entries je
SET entry_type = CASE
  WHEN t.type = 'transfer' THEN 'transfer'
  WHEN ca.class IN ('asset', 'bank') THEN
    CASE WHEN t.amount >= 0 THEN 'deposit' ELSE 'withdrawal' END
  WHEN ca.class = 'liability' THEN
    CASE WHEN t.type = 'expense' THEN 'charge' ELSE 'payment' END
  WHEN ca.class = 'expense' THEN
    CASE WHEN t.type = 'expense' THEN 'expense' ELSE 'refund' END
  ELSE 'adjustment'
END
FROM transactions t
JOIN user_chart_of_accounts ca ON ca.id = t.bank_account_id
WHERE t.journal_entry_id = je.id
  AND je.entry_type != 'opening_balance';

-- Step 3: Re-backfill entry_number prefix to match corrected entry_type
UPDATE journal_entries je
SET entry_number = (
  CASE je.entry_type
    WHEN 'deposit'    THEN 'DEP'
    WHEN 'withdrawal' THEN 'WD'
    WHEN 'charge'     THEN 'CHG'
    WHEN 'payment'    THEN 'PMT'
    WHEN 'expense'    THEN 'EXP'
    WHEN 'refund'     THEN 'RFD'
    WHEN 'transfer'   THEN 'TRF'
    ELSE LEFT(je.entry_number, POSITION('-' IN je.entry_number) - 1)
  END
  || SUBSTRING(je.entry_number FROM POSITION('-' IN je.entry_number))
)
FROM transactions t
WHERE t.journal_entry_id = je.id
  AND je.entry_type != 'opening_balance'
  AND je.entry_number NOT LIKE (
    CASE je.entry_type
      WHEN 'deposit'    THEN 'DEP-%'
      WHEN 'withdrawal' THEN 'WD-%'
      WHEN 'charge'     THEN 'CHG-%'
      WHEN 'payment'    THEN 'PMT-%'
      WHEN 'expense'    THEN 'EXP-%'
      WHEN 'refund'     THEN 'RFD-%'
      WHEN 'transfer'   THEN 'TRF-%'
      ELSE 'ADJ-%'
    END
  );

-- Step 4: Update audit_log descriptions to reflect corrected entry numbers
UPDATE audit_logs al
SET
  description = je.entry_number || ': ' || SPLIT_PART(al.description, ': ', 2),
  metadata = al.metadata || jsonb_build_object('entry_number', je.entry_number)
FROM journal_entries je
WHERE (al.metadata->>'journal_entry_id')::uuid = je.id
  AND al.action = 'post_transaction'
  AND al.description NOT LIKE je.entry_number || ':%';
