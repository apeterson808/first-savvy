/*
  # Fix Journal Trigger to Use Transaction Type

  ## Issue
  The trigger currently uses `NEW.amount > 0` to determine if money is coming
  in or going out. This is incorrect because:
  - An expense transaction with amount=+2.00 means $2 spent (money OUT)
  - The trigger saw +2.00 and treated it as money IN

  ## Fix
  Use the transaction TYPE field instead of amount sign:
  - type='expense' → money OUT of asset (credit asset, debit expense)
  - type='income' → money IN to asset (debit asset, credit income)
  - Amount sign should match the type for consistency

  ## Changes
  - Replace amount sign checks with type checks
  - For assets: expense type → credit asset, income type → debit asset
  - For liabilities: payment type → credit liability, charge type → debit liability
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
    v_should_create_entry := (NEW.journal_entry_id IS NULL AND NEW.status = 'posted');
  ELSIF TG_OP = 'UPDATE' THEN
    v_should_create_entry := (
      NEW.journal_entry_id IS NULL AND (
        (OLD.category_account_id IS NULL AND NEW.category_account_id IS NOT NULL) OR
        (OLD.status != 'posted' AND NEW.status = 'posted')
      )
    );
  END IF;

  IF NOT v_should_create_entry THEN
    RETURN NEW;
  END IF;

  IF NEW.transfer_pair_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_journal_source := CASE NEW.source
    WHEN 'manual' THEN 'manual'
    WHEN 'api' THEN 'import'
    WHEN 'csv' THEN 'import'
    WHEN 'ofx' THEN 'import'
    ELSE 'import'
  END;

  SELECT EXISTS(
    SELECT 1 FROM transaction_splits WHERE transaction_id = NEW.id
  ) INTO v_has_splits;

  SELECT class INTO v_bank_account_class
  FROM user_chart_of_accounts
  WHERE id = NEW.bank_account_id;

  IF NEW.category_account_id IS NOT NULL THEN
    v_category_account_id := NEW.category_account_id;
    SELECT class INTO v_category_account_class
    FROM user_chart_of_accounts
    WHERE id = v_category_account_id;
  ELSIF NOT v_has_splits THEN
    IF NEW.type = 'income' OR (NEW.type = 'expense' AND NEW.amount < 0) THEN
      SELECT id, class INTO v_category_account_id, v_category_account_class
      FROM user_chart_of_accounts
      WHERE profile_id = NEW.profile_id AND template_account_number = 4999
      LIMIT 1;
    ELSE
      SELECT id, class INTO v_category_account_id, v_category_account_class
      FROM user_chart_of_accounts
      WHERE profile_id = NEW.profile_id AND template_account_number = 9999
      LIMIT 1;
    END IF;
  ELSE
    v_category_account_class := NULL;
  END IF;

  v_entry_type := 'adjustment';

  SELECT COALESCE(MAX(CAST(SUBSTRING(entry_number FROM 4) AS INTEGER)), 0) + 1
  INTO v_entry_number
  FROM journal_entries
  WHERE profile_id = NEW.profile_id;

  v_entry_number := 'JE-' || LPAD(v_entry_number::text, 4, '0');

  INSERT INTO journal_entries (
    profile_id, user_id, entry_date, entry_number, description, entry_type, source
  ) VALUES (
    NEW.profile_id, NEW.user_id, NEW.date, v_entry_number, 
    NEW.original_description, v_entry_type, v_journal_source
  ) RETURNING id INTO v_journal_entry_id;

  v_line_number := 1;

  IF NOT v_has_splits THEN
    -- Use transaction TYPE to determine debit/credit direction
    IF v_bank_account_class = 'asset' THEN
      IF NEW.type = 'income' THEN
        -- Income: money IN to asset (debit asset, credit income)
        INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
        VALUES (v_journal_entry_id, v_line_number, NEW.bank_account_id, ABS(NEW.amount), NULL, NEW.original_description, NEW.profile_id, NEW.user_id);
        v_line_number := v_line_number + 1;

        INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
        VALUES (v_journal_entry_id, v_line_number, v_category_account_id, NULL, ABS(NEW.amount), NEW.original_description, NEW.profile_id, NEW.user_id);
      ELSE
        -- Expense: money OUT from asset (debit expense, credit asset)
        INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
        VALUES (v_journal_entry_id, v_line_number, v_category_account_id, ABS(NEW.amount), NULL, NEW.original_description, NEW.profile_id, NEW.user_id);
        v_line_number := v_line_number + 1;

        INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
        VALUES (v_journal_entry_id, v_line_number, NEW.bank_account_id, NULL, ABS(NEW.amount), NEW.original_description, NEW.profile_id, NEW.user_id);
      END IF;
    ELSIF v_bank_account_class = 'liability' THEN
      IF NEW.type = 'expense' OR NEW.amount > 0 THEN
        -- Payment on liability: reduces debt (debit liability, credit asset/cash)
        -- But we're recording from liability perspective, so: debit expense, credit liability
        INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
        VALUES (v_journal_entry_id, v_line_number, v_category_account_id, ABS(NEW.amount), NULL, NEW.original_description, NEW.profile_id, NEW.user_id);
        v_line_number := v_line_number + 1;

        INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
        VALUES (v_journal_entry_id, v_line_number, NEW.bank_account_id, NULL, ABS(NEW.amount), NEW.original_description, NEW.profile_id, NEW.user_id);
      ELSE
        -- Charge on liability: increases debt (debit liability, credit income)
        INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
        VALUES (v_journal_entry_id, v_line_number, NEW.bank_account_id, ABS(NEW.amount), NULL, NEW.original_description, NEW.profile_id, NEW.user_id);
        v_line_number := v_line_number + 1;

        INSERT INTO journal_entry_lines (journal_entry_id, line_number, account_id, debit_amount, credit_amount, description, profile_id, user_id)
        VALUES (v_journal_entry_id, v_line_number, v_category_account_id, NULL, ABS(NEW.amount), NEW.original_description, NEW.profile_id, NEW.user_id);
      END IF;
    END IF;
  END IF;

  NEW.journal_entry_id := v_journal_entry_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION auto_create_journal_entry_from_transaction() IS
'Creates journal entries using transaction TYPE instead of amount sign to determine debit/credit direction';
