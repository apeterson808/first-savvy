/*
  # Fix Actor Attribution for Post Transaction

  ## Problem
  The trigger `auto_create_journal_entry_from_transaction` runs as SECURITY DEFINER,
  which means auth.uid() returns NULL inside the trigger body. As a result, the
  audit_log row has no actor when a household member (e.g. Jenna) posts a transaction.

  ## Fix
  1. `rpc_post_transaction` captures auth.uid() + display name BEFORE flipping status,
     stores them in session-local config vars (app.actor_user_id, app.actor_display_name),
     then the trigger reads those vars instead of calling auth.uid() directly.
  2. Also remove the duplicate trigger — there are two triggers both calling the same
     function (auto_create_journal_entry_trigger and trigger_auto_create_journal_entry).
     Keep only the BEFORE UPDATE OF status one.
*/

-- Step 1: Update rpc_post_transaction to set actor config before flipping status
CREATE OR REPLACE FUNCTION rpc_post_transaction(p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_transaction_record RECORD;
  v_bank_account_class text;
  v_actor_user_id uuid;
  v_actor_display_name text;
BEGIN
  SELECT * INTO v_transaction_record
  FROM transactions
  WHERE id = p_transaction_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
  END IF;

  -- Verify caller has access to this profile
  IF NOT has_profile_access(v_transaction_record.profile_id) THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  SELECT class INTO v_bank_account_class
  FROM user_chart_of_accounts
  WHERE id = v_transaction_record.bank_account_id;

  IF v_transaction_record.type NOT IN ('transfer', 'credit_card_payment')
  AND v_transaction_record.paired_transfer_id IS NULL
  AND COALESCE(v_transaction_record.is_transfer_pair, false) = false
  AND v_transaction_record.is_split = false
  AND v_transaction_record.category_account_id IS NULL THEN
    IF v_transaction_record.type = 'income' AND v_bank_account_class = 'liability' THEN
      RAISE EXCEPTION 'Cannot post credit card payment: must be categorized or marked as a transfer first';
    ELSE
      RAISE EXCEPTION 'Cannot post transaction: category is required';
    END IF;
  END IF;

  -- Capture actor NOW while auth.uid() is available (before trigger fires)
  v_actor_user_id := auth.uid();
  IF v_actor_user_id IS NOT NULL THEN
    SELECT COALESCE(
      NULLIF(TRIM(COALESCE(display_name, '')), ''),
      NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
    )
    INTO v_actor_display_name
    FROM user_settings
    WHERE id = v_actor_user_id;
  END IF;

  -- Store actor in session config so the trigger can read it
  PERFORM set_config('app.actor_user_id', COALESCE(v_actor_user_id::text, ''), true);
  PERFORM set_config('app.actor_display_name', COALESCE(v_actor_display_name, ''), true);
  PERFORM set_config('app.internal_status_write', 'true', true);

  UPDATE transactions
  SET status = 'posted'
  WHERE id = p_transaction_id
  RETURNING * INTO v_transaction_record;

  v_result := to_jsonb(v_transaction_record);

  PERFORM set_config('app.internal_status_write', 'false', true);
  PERFORM set_config('app.actor_user_id', '', true);
  PERFORM set_config('app.actor_display_name', '', true);

  RETURN v_result;
END;
$$;

-- Step 2: Update the trigger function to read actor from session config
CREATE OR REPLACE FUNCTION auto_create_journal_entry_from_transaction()
RETURNS TRIGGER
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

  IF NEW.type = 'transfer' THEN
    v_counter_entry_type := 'transfer';
    v_je_entry_type := 'transfer';
  ELSIF NEW.paired_transfer_id IS NOT NULL THEN
    v_counter_entry_type := 'adjustment';
    v_je_entry_type := 'adjustment';
  ELSE
    v_counter_entry_type := 'adjustment';
    v_je_entry_type := 'adjustment';
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

  -- Read actor from session config (set by rpc_post_transaction before triggering)
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

-- Step 3: Remove the duplicate trigger, keep only the one that fires on status change
DROP TRIGGER IF EXISTS trigger_auto_create_journal_entry ON transactions;
