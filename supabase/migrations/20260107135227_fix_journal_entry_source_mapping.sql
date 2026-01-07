/*
  # Fix Journal Entry Source Mapping
  
  ## Problem
  The auto_create_journal_entry_from_transaction trigger copies the transaction source,
  but transactions can have source='api' which violates the journal_entries constraint.
  
  Journal entries only allow: manual, import, system, migration
  
  ## Fix
  Always use 'system' for auto-generated journal entries since they are created by triggers.
*/

CREATE OR REPLACE FUNCTION auto_create_journal_entry_from_transaction()
RETURNS TRIGGER AS $$
DECLARE
  v_journal_entry_id uuid;
  v_entry_number text;
  v_line_number int := 1;
  v_category_account_class text;
  v_has_splits boolean := false;
  v_split_record record;
  v_entry_type text;
BEGIN
  IF NEW.journal_entry_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.category_account_id IS NULL THEN
    SELECT id INTO NEW.category_account_id
    FROM user_chart_of_accounts
    WHERE profile_id = NEW.profile_id
      AND account_name = 'Uncategorized'
      AND class = 'expense'
    LIMIT 1;

    IF NEW.category_account_id IS NULL THEN
      RAISE EXCEPTION 'Cannot create journal entry: Uncategorized expense account not found';
    END IF;
  END IF;

  SELECT EXISTS(
    SELECT 1 FROM transaction_splits WHERE transaction_id = NEW.id
  ) INTO v_has_splits;

  IF NEW.type = 'transfer' THEN
    v_entry_type := 'transfer';
  ELSE
    v_entry_type := 'adjustment';
  END IF;

  v_entry_number := generate_journal_entry_number(NEW.profile_id);

  INSERT INTO journal_entries (
    profile_id, user_id, entry_date, entry_number,
    description, entry_type, source
  ) VALUES (
    NEW.profile_id, NEW.user_id, NEW.date,
    v_entry_number, NEW.original_description, v_entry_type,
    'system'
  ) RETURNING id INTO v_journal_entry_id;

  v_line_number := 1;

  IF v_has_splits THEN
    FOR v_split_record IN
      SELECT * FROM transaction_splits
      WHERE transaction_id = NEW.id ORDER BY split_number
    LOOP
      SELECT class INTO v_category_account_class
      FROM user_chart_of_accounts WHERE id = v_split_record.category_account_id;

      IF v_category_account_class IN ('expense', 'asset') THEN
        INSERT INTO journal_entry_lines (
          journal_entry_id, profile_id, user_id, account_id,
          line_number, debit_amount, description
        ) VALUES (
          v_journal_entry_id, NEW.profile_id, NEW.user_id,
          v_split_record.category_account_id, v_line_number,
          ABS(v_split_record.amount), v_split_record.description
        );
      ELSE
        INSERT INTO journal_entry_lines (
          journal_entry_id, profile_id, user_id, account_id,
          line_number, credit_amount, description
        ) VALUES (
          v_journal_entry_id, NEW.profile_id, NEW.user_id,
          v_split_record.category_account_id, v_line_number,
          ABS(v_split_record.amount), v_split_record.description
        );
      END IF;
      v_line_number := v_line_number + 1;
    END LOOP;

    IF v_category_account_class IN ('expense', 'asset') THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, credit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id,
        NEW.bank_account_id, v_line_number,
        ABS(NEW.amount), COALESCE(NEW.description, NEW.original_description)
      );
    ELSE
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, debit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id,
        NEW.bank_account_id, v_line_number,
        ABS(NEW.amount), COALESCE(NEW.description, NEW.original_description)
      );
    END IF;

  ELSE
    SELECT class INTO v_category_account_class
    FROM user_chart_of_accounts WHERE id = NEW.category_account_id;

    IF v_category_account_class IN ('expense', 'asset') THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, debit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id,
        NEW.category_account_id, v_line_number,
        ABS(NEW.amount), COALESCE(NEW.description, NEW.original_description)
      );
      v_line_number := v_line_number + 1;

      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, credit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id,
        NEW.bank_account_id, v_line_number,
        ABS(NEW.amount), COALESCE(NEW.description, NEW.original_description)
      );
    ELSE
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, credit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id,
        NEW.category_account_id, v_line_number,
        ABS(NEW.amount), COALESCE(NEW.description, NEW.original_description)
      );
      v_line_number := v_line_number + 1;

      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, debit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id,
        NEW.bank_account_id, v_line_number,
        ABS(NEW.amount), COALESCE(NEW.description, NEW.original_description)
      );
    END IF;
  END IF;

  NEW.journal_entry_id := v_journal_entry_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;
