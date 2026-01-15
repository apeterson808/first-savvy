/*
  # Fix Journal Trigger Status Gate

  ## Problem
  The trigger on line 43 creates journal entries when a category is added,
  regardless of transaction status. This means PENDING transactions get 
  journal entries when they're categorized, which is incorrect.

  ## QuickBooks Behavior
  - Pending transactions should NEVER create journal entries
  - Journal entries only created when status = 'posted'
  - Categorizing a pending transaction should NOT post it

  ## Fix
  Add status check to the category assignment condition:
  - Only create entry if status is 'posted' AND category is added
  - Pending transactions remain in review queue without journal entries
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
  -- ============================================================================
  -- CRITICAL: Only create journal entries for POSTED transactions
  -- ============================================================================
  IF TG_OP = 'INSERT' THEN
    v_should_create_entry := (NEW.journal_entry_id IS NULL AND NEW.status = 'posted');
  ELSIF TG_OP = 'UPDATE' THEN
    v_should_create_entry := (
      NEW.journal_entry_id IS NULL AND (
        -- Status changed to posted
        (OLD.status != 'posted' AND NEW.status = 'posted') OR
        -- Category added to ALREADY POSTED transaction
        (OLD.status = 'posted' AND NEW.status = 'posted' AND OLD.category_account_id IS NULL AND NEW.category_account_id IS NOT NULL)
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

    IF v_category_account_id IS NULL THEN
      RAISE EXCEPTION 'Cannot create journal entry: Uncategorized account not found for profile_id %', NEW.profile_id;
    END IF;

    NEW.category_account_id := v_category_account_id;
  END IF;

  IF NEW.source = 'opening_balance' THEN
    v_entry_type := 'opening_balance';
  ELSIF NEW.original_type = 'transfer' THEN
    v_entry_type := 'transfer';
  ELSE
    v_entry_type := 'adjustment';
  END IF;

  v_entry_number := generate_journal_entry_number(NEW.profile_id);

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

  v_line_number := 1;

  IF v_has_splits THEN
    FOR v_split_record IN
      SELECT * FROM transaction_splits
      WHERE transaction_id = NEW.id
      ORDER BY split_number
    LOOP
      SELECT class INTO v_category_account_class
      FROM user_chart_of_accounts
      WHERE id = v_split_record.category_account_id;

      IF NEW.type = 'expense' THEN
        INSERT INTO journal_entry_lines (
          journal_entry_id, profile_id, user_id, account_id, line_number,
          debit_amount, description
        ) VALUES (
          v_journal_entry_id, NEW.profile_id, NEW.user_id,
          v_split_record.category_account_id, v_line_number,
          ABS(v_split_record.amount), v_split_record.description
        );
      ELSE
        INSERT INTO journal_entry_lines (
          journal_entry_id, profile_id, user_id, account_id, line_number,
          credit_amount, description
        ) VALUES (
          v_journal_entry_id, NEW.profile_id, NEW.user_id,
          v_split_record.category_account_id, v_line_number,
          ABS(v_split_record.amount), v_split_record.description
        );
      END IF;

      v_line_number := v_line_number + 1;
    END LOOP;

    IF NEW.type = 'expense' THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id, line_number,
        credit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.bank_account_id,
        v_line_number, ABS(NEW.amount), COALESCE(NEW.description, NEW.original_description)
      );
    ELSE
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id, line_number,
        debit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.bank_account_id,
        v_line_number, ABS(NEW.amount), COALESCE(NEW.description, NEW.original_description)
      );
    END IF;
  ELSE
    IF NEW.type = 'expense' THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id, line_number,
        debit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, v_category_account_id,
        v_line_number, ABS(NEW.amount), COALESCE(NEW.description, NEW.original_description)
      );
      v_line_number := v_line_number + 1;

      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id, line_number,
        credit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.bank_account_id,
        v_line_number, ABS(NEW.amount), COALESCE(NEW.description, NEW.original_description)
      );
    ELSE
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id, line_number,
        credit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, v_category_account_id,
        v_line_number, ABS(NEW.amount), COALESCE(NEW.description, NEW.original_description)
      );
      v_line_number := v_line_number + 1;

      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id, line_number,
        debit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.bank_account_id,
        v_line_number, ABS(NEW.amount), COALESCE(NEW.description, NEW.original_description)
      );
    END IF;
  END IF;

  NEW.journal_entry_id := v_journal_entry_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

COMMENT ON FUNCTION auto_create_journal_entry_from_transaction IS
'Automatically creates journal entries ONLY for posted transactions (QuickBooks-style behavior).
- Pending transactions do NOT create journal entries (even when categorized)
- Journal entries only created when status changes to posted OR category added to already-posted transaction
- Uses template_account_number (4999/9999) for uncategorized accounts';