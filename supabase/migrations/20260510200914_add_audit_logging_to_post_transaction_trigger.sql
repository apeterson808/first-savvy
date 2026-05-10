/*
  # Add Audit Logging to Post Transaction Trigger

  ## Problem
  When a transaction is posted, no audit_log entry is created. The journal entry
  is auto-created in the `auto_create_journal_entry_from_transaction` trigger, but
  that trigger never wrote to audit_logs. So posting was invisible in audit history.

  ## Fix
  Update the trigger function to insert an audit_logs row after creating the journal
  entry, capturing who posted it via auth.uid() and the generated entry_number.

  Note: auth.uid() works in trigger context when called from an authenticated RPC.
*/

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
  -- Only create journal entries for POSTED transactions with categories
  IF NEW.status != 'posted' OR NEW.category_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if journal entry already exists
  IF NEW.journal_entry_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Determine entry types
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

  -- Generate entry number
  v_entry_number := generate_journal_entry_number(NEW.profile_id, v_counter_entry_type);

  -- Create journal entry header
  INSERT INTO journal_entries (
    profile_id,
    user_id,
    entry_date,
    entry_number,
    description,
    entry_type,
    source
  ) VALUES (
    NEW.profile_id,
    NEW.user_id,
    NEW.date,
    v_entry_number,
    COALESCE(NEW.description, NEW.original_description),
    v_je_entry_type,
    CASE
      WHEN NEW.source = 'import' THEN 'import'
      WHEN NEW.source = 'manual' THEN 'manual'
      ELSE 'system'
    END
  )
  RETURNING id INTO v_journal_entry_id;

  -- Get account classes
  SELECT class INTO v_bank_account_class
  FROM user_chart_of_accounts
  WHERE id = NEW.bank_account_id;

  SELECT class INTO v_category_account_class
  FROM user_chart_of_accounts
  WHERE id = NEW.category_account_id;

  -- Check for split transactions
  SELECT COUNT(*) INTO v_split_count
  FROM transaction_splits
  WHERE transaction_id = NEW.id;

  -- Handle NON-SPLIT transactions
  IF v_split_count = 0 THEN
    -- Line 1: Category account side
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

    -- Line 2: Bank account offset
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

  -- Handle split transactions
  ELSE
    FOR v_split_record IN
      SELECT * FROM transaction_splits
      WHERE transaction_id = NEW.id
      ORDER BY split_number
    LOOP
      SELECT class INTO v_category_account_class
      FROM user_chart_of_accounts
      WHERE id = v_split_record.category_account_id;

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

  -- Update transaction with journal entry references
  NEW.journal_entry_id := v_journal_entry_id;
  NEW.current_journal_entry_id := v_journal_entry_id;

  IF NEW.original_journal_entry_id IS NULL THEN
    NEW.original_journal_entry_id := v_journal_entry_id;
  END IF;

  -- Log the post action to audit history
  -- auth.uid() identifies the actual person posting (owner or household member)
  v_actor_user_id := auth.uid();

  IF v_actor_user_id IS NOT NULL THEN
    SELECT COALESCE(
      NULLIF(TRIM(COALESCE(display_name, '')), ''),
      NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
    )
    INTO v_actor_display_name
    FROM user_settings
    WHERE id = v_actor_user_id;

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
      v_actor_user_id,
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
  END IF;

  RETURN NEW;
END;
$$;
