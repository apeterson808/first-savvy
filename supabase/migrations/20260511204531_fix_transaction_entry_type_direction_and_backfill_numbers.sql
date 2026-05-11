/*
  # Fix entry type direction logic and backfill entry_number prefixes

  1. Problems fixed
    - Liability direction was inverted: a credit card charge has amount < 0, so
      `amount <= 0` correctly identifies a charge (not payment). Previous migration
      had the condition backwards.
    - Backfill entry_number strings for existing journal entries linked to transactions
      so the Reference column shows the correct prefix instead of ADJ-.

  2. Direction rules (from how the trigger creates journal lines):
    - asset/bank:   amount >= 0 → deposit (debit to asset), amount < 0 → withdrawal
    - liability:    amount < 0  → charge  (debit to liability), amount > 0 → payment
    - expense:      amount >= 0 → expense, amount < 0 → refund

  3. Entry number prefix mapping
    - deposit    → DEP
    - withdrawal → WD
    - charge     → CHG
    - payment    → PMT
    - expense    → EXP
    - refund     → RFD
    - transfer   → TRF (unchanged)
    - opening_balance → OB (unchanged)
    - adjustment → ADJ (manual entries, unchanged)
*/

-- Step 1: Fix the trigger with correct direction logic for liability accounts
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
        -- charge: spending on cc = negative amount; payment = positive amount
        CASE WHEN NEW.amount < 0 THEN 'charge' ELSE 'payment' END
      WHEN v_bank_account_class = 'expense' THEN
        CASE WHEN NEW.amount >= 0 THEN 'expense' ELSE 'refund' END
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

-- Step 2: Re-backfill entry_type with corrected direction logic
DO $$
BEGIN
  UPDATE journal_entries je
  SET entry_type = CASE
    WHEN t.type = 'transfer' THEN 'transfer'
    WHEN ca.class IN ('asset', 'bank') THEN
      CASE WHEN t.amount >= 0 THEN 'deposit' ELSE 'withdrawal' END
    WHEN ca.class = 'liability' THEN
      CASE WHEN t.amount < 0 THEN 'charge' ELSE 'payment' END
    WHEN ca.class = 'expense' THEN
      CASE WHEN t.amount >= 0 THEN 'expense' ELSE 'refund' END
    ELSE 'adjustment'
  END
  FROM transactions t
  JOIN user_chart_of_accounts ca ON ca.id = t.bank_account_id
  WHERE t.journal_entry_id = je.id
    AND je.entry_type NOT IN ('opening_balance', 'adjustment', 'undo');
END $$;

-- Step 3: Backfill entry_number strings to replace ADJ- prefix with the correct prefix
DO $$
DECLARE
  v_seq_suffix text;
  v_new_prefix text;
  v_new_number text;
BEGIN
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
    AND je.entry_type NOT IN ('opening_balance', 'adjustment', 'undo')
    AND je.entry_number LIKE 'ADJ-%';
END $$;
