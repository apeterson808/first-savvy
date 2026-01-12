/*
  # Fix Journal Entry Trigger - Remove Status Column

  1. Issue
    - The trigger tries to insert 'status' into journal_entries table
    - journal_entries table doesn't have a status column
    - All journal entries are implicitly "posted" when created

  2. Changes
    - Remove status column from INSERT statement in trigger
    - Journal entries don't need status - they're always posted
    - Transactions have status field (pending/posted) which determines if journal entry is created
*/

CREATE OR REPLACE FUNCTION auto_create_journal_entry_from_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_journal_entry_id uuid;
  v_entry_number text;
  v_entry_type text;
  v_bank_account_class text;
  v_category_account_class text;
  v_category_account_id uuid;
  v_has_splits boolean;
  v_split_record record;
  v_line_number integer;
  v_should_create_entry boolean := false;
  v_journal_source text;
BEGIN
  -- Determine if we should create a journal entry
  IF TG_OP = 'INSERT' THEN
    -- On INSERT: create entry if no journal_entry_id exists and status is posted
    v_should_create_entry := (NEW.journal_entry_id IS NULL AND NEW.status = 'posted');
  ELSIF TG_OP = 'UPDATE' THEN
    -- On UPDATE: create entry if:
    -- 1. No journal_entry_id exists yet
    -- 2. AND (category was just added OR status changed to posted)
    v_should_create_entry := (
      NEW.journal_entry_id IS NULL AND (
        (OLD.category_account_id IS NULL AND NEW.category_account_id IS NOT NULL) OR
        (OLD.status != 'posted' AND NEW.status = 'posted')
      )
    );
  END IF;

  -- Exit early if we shouldn't create an entry
  IF NOT v_should_create_entry THEN
    RETURN NEW;
  END IF;

  -- Skip if this is a transfer (will be handled separately)
  IF NEW.transfer_pair_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Map transaction source to valid journal entry source
  v_journal_source := CASE NEW.source
    WHEN 'manual' THEN 'manual'
    WHEN 'api' THEN 'import'
    WHEN 'csv' THEN 'import'
    WHEN 'ofx' THEN 'import'
    ELSE 'import'
  END;

  -- Check if transaction has splits
  SELECT EXISTS(
    SELECT 1 FROM transaction_splits
    WHERE transaction_id = NEW.id
  ) INTO v_has_splits;

  -- Get account classes for proper journal entry type determination
  SELECT class INTO v_bank_account_class
  FROM user_chart_of_accounts
  WHERE id = NEW.bank_account_id;

  -- Determine category account to use
  IF NEW.category_account_id IS NOT NULL THEN
    -- Use the assigned category
    v_category_account_id := NEW.category_account_id;
    SELECT class INTO v_category_account_class
    FROM user_chart_of_accounts
    WHERE id = v_category_account_id;
  ELSIF NOT v_has_splits THEN
    -- No category assigned and no splits - use uncategorized account
    -- Determine if income or expense based on transaction type or amount sign
    IF NEW.type = 'income' OR (NEW.type = 'expense' AND NEW.amount < 0) THEN
      -- Use Uncategorized Income (4999)
      SELECT id, class INTO v_category_account_id, v_category_account_class
      FROM user_chart_of_accounts
      WHERE profile_id = NEW.profile_id
        AND template_account_number = 4999
      LIMIT 1;
    ELSE
      -- Use Uncategorized Expense (9999)
      SELECT id, class INTO v_category_account_id, v_category_account_class
      FROM user_chart_of_accounts
      WHERE profile_id = NEW.profile_id
        AND template_account_number = 9999
      LIMIT 1;
    END IF;
  ELSE
    -- Has splits, will handle below
    v_category_account_class := NULL;
  END IF;

  -- Determine entry type based on account classes
  IF v_bank_account_class = 'asset' AND v_category_account_class IN ('income', 'expense') THEN
    v_entry_type := 'adjustment';
  ELSIF v_bank_account_class = 'liability' AND v_category_account_class IN ('income', 'expense') THEN
    v_entry_type := 'adjustment';
  ELSE
    v_entry_type := 'adjustment';
  END IF;

  -- Generate entry number
  SELECT COALESCE(MAX(CAST(SUBSTRING(entry_number FROM 4) AS INTEGER)), 0) + 1
  INTO v_entry_number
  FROM journal_entries
  WHERE profile_id = NEW.profile_id;

  v_entry_number := 'JE-' || LPAD(v_entry_number::text, 4, '0');

  -- Create journal entry (removed status column)
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
    NEW.original_description,
    v_entry_type,
    v_journal_source
  )
  RETURNING id INTO v_journal_entry_id;

  -- Create journal entry lines
  v_line_number := 1;

  IF v_has_splits THEN
    -- Handle split transactions
    FOR v_split_record IN
      SELECT * FROM transaction_splits
      WHERE transaction_id = NEW.id
      ORDER BY split_number
    LOOP
      SELECT class INTO v_category_account_class
      FROM user_chart_of_accounts
      WHERE id = v_split_record.category_account_id;

      -- Debit or credit based on account class and amount sign
      IF v_bank_account_class = 'asset' THEN
        IF NEW.amount > 0 THEN
          -- Money in to asset: debit asset, credit income/expense
          INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
          VALUES (v_journal_entry_id, v_line_number, NEW.bank_account_id, ABS(v_split_record.amount), 0, v_split_record.description, NEW.profile_id, NEW.user_id);
          v_line_number := v_line_number + 1;

          INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
          VALUES (v_journal_entry_id, v_line_number, v_split_record.category_account_id, 0, ABS(v_split_record.amount), v_split_record.description, NEW.profile_id, NEW.user_id);
          v_line_number := v_line_number + 1;
        ELSE
          -- Money out from asset: credit asset, debit expense
          INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
          VALUES (v_journal_entry_id, v_line_number, v_split_record.category_account_id, ABS(v_split_record.amount), 0, v_split_record.description, NEW.profile_id, NEW.user_id);
          v_line_number := v_line_number + 1;

          INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
          VALUES (v_journal_entry_id, v_line_number, NEW.bank_account_id, 0, ABS(v_split_record.amount), v_split_record.description, NEW.profile_id, NEW.user_id);
          v_line_number := v_line_number + 1;
        END IF;
      ELSIF v_bank_account_class = 'liability' THEN
        IF NEW.amount > 0 THEN
          -- Payment on liability: credit liability (reduces debt), debit asset/expense
          INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
          VALUES (v_journal_entry_id, v_line_number, v_split_record.category_account_id, ABS(v_split_record.amount), 0, v_split_record.description, NEW.profile_id, NEW.user_id);
          v_line_number := v_line_number + 1;

          INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
          VALUES (v_journal_entry_id, v_line_number, NEW.bank_account_id, 0, ABS(v_split_record.amount), v_split_record.description, NEW.profile_id, NEW.user_id);
          v_line_number := v_line_number + 1;
        ELSE
          -- Charge on liability: debit liability (increases debt), credit income/expense
          INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
          VALUES (v_journal_entry_id, v_line_number, NEW.bank_account_id, ABS(v_split_record.amount), 0, v_split_record.description, NEW.profile_id, NEW.user_id);
          v_line_number := v_line_number + 1;

          INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
          VALUES (v_journal_entry_id, v_line_number, v_split_record.category_account_id, 0, ABS(v_split_record.amount), v_split_record.description, NEW.profile_id, NEW.user_id);
          v_line_number := v_line_number + 1;
        END IF;
      END IF;
    END LOOP;
  ELSE
    -- No splits - create standard two-line entry
    IF v_bank_account_class = 'asset' THEN
      IF NEW.amount > 0 THEN
        -- Money in to asset: debit asset, credit income
        INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
        VALUES (v_journal_entry_id, v_line_number, NEW.bank_account_id, ABS(NEW.amount), 0, NEW.original_description, NEW.profile_id, NEW.user_id);
        v_line_number := v_line_number + 1;

        INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
        VALUES (v_journal_entry_id, v_line_number, v_category_account_id, 0, ABS(NEW.amount), NEW.original_description, NEW.profile_id, NEW.user_id);
      ELSE
        -- Money out from asset: credit asset, debit expense
        INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
        VALUES (v_journal_entry_id, v_line_number, v_category_account_id, ABS(NEW.amount), 0, NEW.original_description, NEW.profile_id, NEW.user_id);
        v_line_number := v_line_number + 1;

        INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
        VALUES (v_journal_entry_id, v_line_number, NEW.bank_account_id, 0, ABS(NEW.amount), NEW.original_description, NEW.profile_id, NEW.user_id);
      END IF;
    ELSIF v_bank_account_class = 'liability' THEN
      IF NEW.amount > 0 THEN
        -- Payment on liability: credit liability (reduces debt), debit expense
        INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
        VALUES (v_journal_entry_id, v_line_number, v_category_account_id, ABS(NEW.amount), 0, NEW.original_description, NEW.profile_id, NEW.user_id);
        v_line_number := v_line_number + 1;

        INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
        VALUES (v_journal_entry_id, v_line_number, NEW.bank_account_id, 0, ABS(NEW.amount), NEW.original_description, NEW.profile_id, NEW.user_id);
      ELSE
        -- Charge on liability: debit liability (increases debt), credit income
        INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
        VALUES (v_journal_entry_id, v_line_number, NEW.bank_account_id, ABS(NEW.amount), 0, NEW.original_description, NEW.profile_id, NEW.user_id);
        v_line_number := v_line_number + 1;

        INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
        VALUES (v_journal_entry_id, v_line_number, v_category_account_id, 0, ABS(NEW.amount), NEW.original_description, NEW.profile_id, NEW.user_id);
      END IF;
    END IF;
  END IF;

  -- Link journal entry back to transaction
  NEW.journal_entry_id := v_journal_entry_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;