/*
  # Fix Journal Entry Trigger to Skip When No Category
  
  ## Overview
  The trigger was creating journal entries with no lines when transactions
  don't have a category_account_id. This causes issues.
  
  ## Changes
  - Skip journal entry creation if transaction has no category and no splits
  - Only create journal entries for fully categorized transactions
*/

CREATE OR REPLACE FUNCTION auto_create_journal_entry_from_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_journal_entry_id uuid;
  v_entry_number text;
  v_entry_type text;
  v_bank_account_class text;
  v_category_account_class text;
  v_has_splits boolean;
  v_split_record record;
  v_line_number integer;
BEGIN
  -- Only process if transaction doesn't already have a journal entry
  IF NEW.journal_entry_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Skip if this is a transfer (will be handled separately)
  IF NEW.transfer_pair_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Check if transaction has splits
  SELECT EXISTS(
    SELECT 1 FROM transaction_splits
    WHERE transaction_id = NEW.id
  ) INTO v_has_splits;

  -- Skip if no category and no splits (transaction not fully categorized yet)
  IF NEW.category_account_id IS NULL AND NOT v_has_splits THEN
    RETURN NEW;
  END IF;

  -- Get account classes for proper journal entry type determination
  SELECT class INTO v_bank_account_class
  FROM user_chart_of_accounts
  WHERE id = NEW.bank_account_id;

  IF NEW.category_account_id IS NOT NULL THEN
    SELECT class INTO v_category_account_class
    FROM user_chart_of_accounts
    WHERE id = NEW.category_account_id;
  END IF;

  -- Determine entry type
  IF NEW.source = 'opening_balance' THEN
    v_entry_type := 'opening_balance';
  ELSIF NEW.original_type = 'transfer' THEN
    v_entry_type := 'transfer';
  ELSE
    v_entry_type := 'adjustment';
  END IF;

  -- Generate journal entry number
  v_entry_number := generate_journal_entry_number(NEW.profile_id);

  -- Create journal entry header
  INSERT INTO journal_entries (
    profile_id,
    user_id,
    entry_date,
    entry_number,
    description,
    entry_type,
    status,
    source
  ) VALUES (
    NEW.profile_id,
    NEW.user_id,
    NEW.date,
    v_entry_number,
    NEW.original_description,
    v_entry_type,
    'posted',
    COALESCE(NEW.source, 'import')
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
      -- Debit the category (expense/asset) or Credit (income/liability)
      IF v_category_account_class IN ('expense', 'asset') THEN
        -- Debit category
        INSERT INTO journal_entry_lines (
          journal_entry_id,
          profile_id,
          user_id,
          account_id,
          line_number,
          debit_amount,
          description
        ) VALUES (
          v_journal_entry_id,
          NEW.profile_id,
          NEW.user_id,
          v_split_record.category_account_id,
          v_line_number,
          ABS(v_split_record.amount),
          v_split_record.description
        );
      ELSE
        -- Credit category (income)
        INSERT INTO journal_entry_lines (
          journal_entry_id,
          profile_id,
          user_id,
          account_id,
          line_number,
          credit_amount,
          description
        ) VALUES (
          v_journal_entry_id,
          NEW.profile_id,
          NEW.user_id,
          v_split_record.category_account_id,
          v_line_number,
          ABS(v_split_record.amount),
          v_split_record.description
        );
      END IF;

      v_line_number := v_line_number + 1;
    END LOOP;

    -- Credit/Debit bank account for total
    IF v_bank_account_class IN ('asset') THEN
      -- Credit bank account (money going out)
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        profile_id,
        user_id,
        account_id,
        line_number,
        credit_amount,
        description
      ) VALUES (
        v_journal_entry_id,
        NEW.profile_id,
        NEW.user_id,
        NEW.bank_account_id,
        v_line_number,
        ABS(NEW.amount),
        'Payment from account'
      );
    ELSE
      -- Debit bank account (liability)
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        profile_id,
        user_id,
        account_id,
        line_number,
        debit_amount,
        description
      ) VALUES (
        v_journal_entry_id,
        NEW.profile_id,
        NEW.user_id,
        NEW.bank_account_id,
        v_line_number,
        ABS(NEW.amount),
        'Payment from account'
      );
    END IF;

  ELSE
    -- No splits - use category_account_id (already verified it exists)
    IF v_category_account_class IN ('expense', 'asset') THEN
      -- Debit category (expense/asset)
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        profile_id,
        user_id,
        account_id,
        line_number,
        debit_amount,
        description
      ) VALUES (
        v_journal_entry_id,
        NEW.profile_id,
        NEW.user_id,
        NEW.category_account_id,
        v_line_number,
        ABS(NEW.amount),
        NEW.description
      );

      v_line_number := v_line_number + 1;

      -- Credit bank account
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        profile_id,
        user_id,
        account_id,
        line_number,
        credit_amount,
        description
      ) VALUES (
        v_journal_entry_id,
        NEW.profile_id,
        NEW.user_id,
        NEW.bank_account_id,
        v_line_number,
        ABS(NEW.amount),
        'Payment from account'
      );

    ELSE
      -- Income: Debit bank account, Credit category
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        profile_id,
        user_id,
        account_id,
        line_number,
        debit_amount,
        description
      ) VALUES (
        v_journal_entry_id,
        NEW.profile_id,
        NEW.user_id,
        NEW.bank_account_id,
        v_line_number,
        ABS(NEW.amount),
        'Deposit to account'
      );

      v_line_number := v_line_number + 1;

      -- Credit category (income)
      INSERT INTO journal_entry_lines (
        journal_entry_id,
        profile_id,
        user_id,
        account_id,
        line_number,
        credit_amount,
        description
      ) VALUES (
        v_journal_entry_id,
        NEW.profile_id,
        NEW.user_id,
        NEW.category_account_id,
        v_line_number,
        ABS(NEW.amount),
        NEW.description
      );
    END IF;
  END IF;

  -- Link journal entry to transaction
  NEW.journal_entry_id := v_journal_entry_id;

  RETURN NEW;
END;
$$;
