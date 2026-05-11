/*
  # Add transaction-specific entry types for meaningful reference prefixes

  1. Changes
    - Expand the entry_type check constraint to include: deposit, withdrawal, charge, payment, expense, refund
    - Update generate_journal_entry_number() to map new types to short prefixes
    - Update auto_create_journal_entry_from_transaction trigger to derive the correct
      entry type from the bank account class and debit/credit direction
    - Backfill existing adjustment journal entries with the correct specific type
      based on the bank account line's debit/credit direction and account class

  2. New prefix mapping
    - deposit    → DEP  (asset/bank account received a debit)
    - withdrawal → WD   (asset/bank account received a credit)
    - charge     → CHG  (liability account received a credit = new charge)
    - payment    → PMT  (liability account received a debit = payment made)
    - expense    → EXP  (expense account received a debit)
    - refund     → RFD  (expense account received a credit)
    - transfer   → TRF  (unchanged)
    - adjustment → ADJ  (manual/fallback, unchanged)
    - opening_balance → OB  (unchanged)

  3. Notes
    - Existing ADJ-XXXX entry numbers are preserved for all existing records
    - Only the entry_type column is backfilled; entry_number strings are NOT changed
    - Future transactions will get the new typed prefixes and counters
*/

-- Step 1: Expand the entry_type constraint
ALTER TABLE journal_entries
  DROP CONSTRAINT IF EXISTS journal_entries_entry_type_check;

ALTER TABLE journal_entries
  ADD CONSTRAINT journal_entries_entry_type_check
  CHECK (entry_type = ANY (ARRAY[
    'transaction', 'adjustment', 'opening_balance',
    'transfer', 'deposit', 'withdrawal',
    'charge', 'payment', 'expense', 'refund'
  ]));

-- Step 2: Replace generate_journal_entry_number with new prefix mapping
CREATE OR REPLACE FUNCTION generate_journal_entry_number(
  p_profile_id uuid,
  p_entry_type text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_number integer;
  v_prefix text;
  v_formatted_number text;
BEGIN
  v_prefix := CASE p_entry_type
    WHEN 'opening_balance' THEN 'OB'
    WHEN 'adjustment'      THEN 'ADJ'
    WHEN 'transfer'        THEN 'TRF'
    WHEN 'reclassification' THEN 'RCL'
    WHEN 'closing'         THEN 'CLS'
    WHEN 'depreciation'    THEN 'DEP'
    WHEN 'accrual'         THEN 'ACR'
    WHEN 'reversal'        THEN 'REV'
    WHEN 'deposit'         THEN 'DEP'
    WHEN 'withdrawal'      THEN 'WD'
    WHEN 'charge'          THEN 'CHG'
    WHEN 'payment'         THEN 'PMT'
    WHEN 'expense'         THEN 'EXP'
    WHEN 'refund'          THEN 'RFD'
    ELSE 'ADJ'
  END;

  INSERT INTO journal_entry_counters (profile_id, entry_type, next_number)
  VALUES (p_profile_id, p_entry_type, 2)
  ON CONFLICT (profile_id, entry_type)
  DO UPDATE SET
    next_number = journal_entry_counters.next_number + 1,
    last_updated = now()
  RETURNING next_number - 1 INTO v_next_number;

  IF v_next_number IS NULL THEN
    v_next_number := 1;
  END IF;

  IF v_next_number < 10000 THEN
    v_formatted_number := v_prefix || '-' || LPAD(v_next_number::text, 4, '0');
  ELSE
    v_formatted_number := v_prefix || '-' || v_next_number::text;
  END IF;

  RETURN v_formatted_number;
END;
$$;

-- Step 3: Replace the posting trigger to derive entry type from account class + direction
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

  -- Look up the bank account class to derive a meaningful entry type
  SELECT class INTO v_bank_account_class
  FROM user_chart_of_accounts WHERE id = NEW.bank_account_id;

  SELECT class INTO v_category_account_class
  FROM user_chart_of_accounts WHERE id = NEW.category_account_id;

  IF NEW.type = 'transfer' THEN
    v_counter_entry_type := 'transfer';
    v_je_entry_type      := 'transfer';
  ELSE
    -- Derive entry type from bank account class and transaction direction
    -- asset/bank: debit (positive amount) = deposit, credit = withdrawal
    -- liability:  debit = payment, credit = charge
    -- expense:    debit = expense, credit = refund
    v_je_entry_type := CASE
      WHEN v_bank_account_class IN ('asset', 'bank') THEN
        CASE WHEN NEW.amount >= 0 THEN 'deposit' ELSE 'withdrawal' END
      WHEN v_bank_account_class = 'liability' THEN
        CASE WHEN NEW.amount <= 0 THEN 'charge' ELSE 'payment' END
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

  -- Reset after category class lookup above may have been overwritten by splits loop
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
    profile_id,
    user_id,
    actor_display_name,
    action,
    entity_type,
    entity_id,
    description,
    metadata
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

-- Step 4: Backfill entry_type on existing journal entries that were posted from transactions
-- We join through the transaction to get bank account class and amount direction
DO $$
BEGIN
  UPDATE journal_entries je
  SET entry_type = CASE
    WHEN t.type = 'transfer' THEN 'transfer'
    WHEN ca.class IN ('asset', 'bank') THEN
      CASE WHEN t.amount >= 0 THEN 'deposit' ELSE 'withdrawal' END
    WHEN ca.class = 'liability' THEN
      CASE WHEN t.amount <= 0 THEN 'charge' ELSE 'payment' END
    WHEN ca.class = 'expense' THEN
      CASE WHEN t.amount >= 0 THEN 'expense' ELSE 'refund' END
    ELSE 'adjustment'
  END
  FROM transactions t
  JOIN user_chart_of_accounts ca ON ca.id = t.bank_account_id
  WHERE t.journal_entry_id = je.id
    AND je.entry_type IN ('adjustment', 'transaction');
END $$;
