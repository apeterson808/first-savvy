/*
  # Update Posting Trigger to Set New Journal Entry Columns

  ## Summary
  Updates auto_create_journal_entry_from_transaction() to populate new columns:
  - current_journal_entry_id: Always set to the newly created JE
  - original_journal_entry_id: Set only if NULL (preserves first JE)
  - journal_entry_id: Maintained for backward compatibility
  
  ## Business Logic
  - First post: Sets both original and current to new JE
  - Re-post after undo: Sets current to new JE, original stays at first JE
  - Provides complete audit trail of all journal entries
  
  ## Changes
  - Added current_journal_entry_id assignment
  - Added conditional original_journal_entry_id assignment
  - Maintained existing journal_entry_id for compatibility
  
  ## Testing Notes
  - Post → undo → re-post should show different current but same original
*/

-- Update the trigger function to set new columns
CREATE OR REPLACE FUNCTION auto_create_journal_entry_from_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
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
BEGIN
  -- Only create journal entries for POSTED transactions with categories
  IF NEW.status != 'posted' OR NEW.category_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if journal entry already exists
  IF NEW.journal_entry_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Generate entry number based on transaction type
  IF NEW.type = 'transfer' THEN
    v_entry_number := generate_journal_entry_number(NEW.profile_id, 'transfer');
  ELSIF NEW.credit_card_payment_id IS NOT NULL THEN
    v_entry_number := generate_journal_entry_number(NEW.profile_id, 'cc_payment');
  ELSE
    v_entry_number := generate_journal_entry_number(NEW.profile_id, 'transaction');
  END IF;

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
    NEW.transaction_date,
    v_entry_number,
    COALESCE(NEW.description, NEW.original_description),
    CASE
      WHEN NEW.type = 'transfer' THEN 'transfer'
      WHEN NEW.credit_card_payment_id IS NOT NULL THEN 'cc_payment'
      ELSE 'transaction'
    END,
    CASE
      WHEN NEW.source = 'import' THEN 'bank_import'
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

  -- Check if this is a split transaction
  SELECT COUNT(*) INTO v_split_count
  FROM transaction_splits
  WHERE transaction_id = NEW.id;

  -- Handle split transactions
  IF v_split_count > 0 THEN
    -- Create split lines
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
          journal_entry_id, profile_id, user_id, account_id,
          line_number, debit_amount, description
        ) VALUES (
          v_journal_entry_id, NEW.profile_id, NEW.user_id,
          v_split_record.category_account_id, v_line_number,
          ABS(v_split_record.amount), v_split_record.description
        );
        v_total_split_debits := v_total_split_debits + ABS(v_split_record.amount);
      ELSE
        INSERT INTO journal_entry_lines (
          journal_entry_id, profile_id, user_id, account_id,
          line_number, credit_amount, description
        ) VALUES (
          v_journal_entry_id, NEW.profile_id, NEW.user_id,
          v_split_record.category_account_id, v_line_number,
          ABS(v_split_record.amount), v_split_record.description
        );
        v_total_split_credits := v_total_split_credits + ABS(v_split_record.amount);
      END IF;

      v_line_number := v_line_number + 1;
    END LOOP;

    -- Calculate bank offset
    v_bank_offset_amount := ABS(NEW.amount);
    
    IF v_total_split_debits > v_total_split_credits THEN
      v_bank_offset_amount := v_total_split_debits;
    ELSE
      v_bank_offset_amount := v_total_split_credits;
    END IF;

    -- Create bank offset line
    IF v_bank_account_class IN ('asset', 'expense') THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, credit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.bank_account_id,
        v_line_number, v_bank_offset_amount, 'Bank offset for split transaction'
      );
    ELSE
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, debit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.bank_account_id,
        v_line_number, v_bank_offset_amount, 'Bank offset for split transaction'
      );
    END IF;

  ELSE
    -- Non-split transaction: Create standard two-line entry
    IF NEW.type = 'expense' THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, debit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.category_account_id,
        v_line_number, ABS(NEW.amount), COALESCE(NEW.description, NEW.original_description)
      );
      v_line_number := v_line_number + 1;

      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, credit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.bank_account_id,
        v_line_number, ABS(NEW.amount), COALESCE(NEW.description, NEW.original_description)
      );

    ELSIF NEW.type = 'income' THEN
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, debit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.bank_account_id,
        v_line_number, ABS(NEW.amount), COALESCE(NEW.description, NEW.original_description)
      );
      v_line_number := v_line_number + 1;

      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, credit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.category_account_id,
        v_line_number, ABS(NEW.amount), COALESCE(NEW.description, NEW.original_description)
      );

    ELSIF NEW.type = 'transfer' THEN
      -- Transfer: debit destination, credit source
      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, debit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.category_account_id,
        v_line_number, ABS(NEW.amount), COALESCE(NEW.description, NEW.original_description)
      );
      v_line_number := v_line_number + 1;

      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id,
        line_number, credit_amount, description
      ) VALUES (
        v_journal_entry_id, NEW.profile_id, NEW.user_id, NEW.bank_account_id,
        v_line_number, ABS(NEW.amount), COALESCE(NEW.description, NEW.original_description)
      );
    END IF;
  END IF;

  -- Update transaction with journal entry references
  NEW.journal_entry_id := v_journal_entry_id;
  NEW.current_journal_entry_id := v_journal_entry_id;
  
  -- Set original_journal_entry_id only if this is the first time posting
  IF NEW.original_journal_entry_id IS NULL THEN
    NEW.original_journal_entry_id := v_journal_entry_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger to ensure proper ordering (runs after status gate trigger)
DROP TRIGGER IF EXISTS auto_create_journal_entry_trigger ON transactions;
CREATE TRIGGER auto_create_journal_entry_trigger
  BEFORE INSERT OR UPDATE OF status ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_journal_entry_from_transaction();

COMMENT ON TRIGGER auto_create_journal_entry_trigger ON transactions IS
'Creates journal entries when transactions are posted. Sets current_journal_entry_id and original_journal_entry_id.';
