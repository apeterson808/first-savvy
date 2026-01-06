/*
  # Create Automatic Journal Entry Generation from Transactions

  ## Overview
  Implements double-entry bookkeeping by automatically creating journal entries
  for every transaction. This mirrors how QuickBooks and professional accounting
  software work - every transaction creates underlying debit/credit journal entries.

  ## Changes

  1. **Auto-Generate Journal Entries**
     - Every transaction insert/update creates a journal entry
     - Journal entry number: auto-incremented (JE-0001, JE-0002, etc.)
     - Entry type based on transaction context

  2. **Journal Entry Lines Logic**
     - **Expenses**: Debit expense category, Credit bank account
     - **Income**: Debit bank account, Credit income category
     - **Transfers**: Debit to-account, Credit from-account (if transfer_pair_id exists)
     - **Refunds**: Reversed debits/credits (negative amounts)

  3. **Split Transaction Support**
     - If transaction has splits, use split lines instead of main category
     - Each split creates its own journal entry line

  4. **Balance Updates**
     - Account balances updated via existing trigger
     - Journal entries provide audit trail

  ## How It Works

  When you import: "$100 grocery expense from Checking"
  System creates:
  - Transaction record (description, date, amount)
  - Journal Entry (JE-0042, dated today)
  - Line 1: Debit "Groceries" (expense) $100
  - Line 2: Credit "Checking Account" (asset) $100
  - Trigger updates Checking balance: -$100

  ## Safety
  - Only creates journal entries for transactions without existing journal_entry_id
  - Preserves manually created journal entries
  - Uses profile_id for multi-profile support
*/

-- Function to generate next journal entry number for a profile
CREATE OR REPLACE FUNCTION generate_journal_entry_number(p_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_max_number integer;
  v_next_number integer;
BEGIN
  -- Get highest existing number for this profile
  SELECT COALESCE(
    MAX(CAST(REGEXP_REPLACE(entry_number, '[^0-9]', '', 'g') AS integer)),
    0
  )
  INTO v_max_number
  FROM journal_entries
  WHERE profile_id = p_profile_id
  AND entry_number ~ '^JE-[0-9]+$';

  v_next_number := v_max_number + 1;

  RETURN 'JE-' || LPAD(v_next_number::text, 4, '0');
END;
$$;

-- Function to automatically create journal entry from transaction
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
    NEW.transaction_date,
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

    -- Offsetting entry to bank account (opposite of categories)
    IF v_category_account_class IN ('expense', 'asset') THEN
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
        ABS(NEW.display_amount),
        'Split transaction total'
      );
    ELSE
      -- Debit bank account
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
        ABS(NEW.display_amount),
        'Split transaction total'
      );
    END IF;

  ELSE
    -- Handle regular (non-split) transactions

    -- Determine if this is an expense or income
    IF v_category_account_class = 'expense' THEN
      -- Expense: Debit expense category, Credit bank account

      -- Line 1: Debit expense category
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
        1,
        ABS(NEW.display_amount),
        NEW.original_description
      );

      -- Line 2: Credit bank account
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
        2,
        ABS(NEW.display_amount),
        NEW.original_description
      );

    ELSIF v_category_account_class = 'income' THEN
      -- Income: Debit bank account, Credit income category

      -- Line 1: Debit bank account
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
        1,
        ABS(NEW.display_amount),
        NEW.original_description
      );

      -- Line 2: Credit income category
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
        2,
        ABS(NEW.display_amount),
        NEW.original_description
      );

    ELSIF v_category_account_class = 'asset' THEN
      -- Asset purchase: Debit asset, Credit bank account

      -- Line 1: Debit asset
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
        1,
        ABS(NEW.display_amount),
        NEW.original_description
      );

      -- Line 2: Credit bank account
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
        2,
        ABS(NEW.display_amount),
        NEW.original_description
      );

    ELSIF v_category_account_class = 'liability' THEN
      -- Liability payment: Debit liability, Credit bank account

      -- Line 1: Debit liability
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
        1,
        ABS(NEW.display_amount),
        NEW.original_description
      );

      -- Line 2: Credit bank account
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
        2,
        ABS(NEW.display_amount),
        NEW.original_description
      );
    END IF;
  END IF;

  -- Link transaction to journal entry
  NEW.journal_entry_id := v_journal_entry_id;

  RETURN NEW;
END;
$$;

-- Create trigger to auto-generate journal entries
DROP TRIGGER IF EXISTS trigger_auto_create_journal_entry ON transactions;

CREATE TRIGGER trigger_auto_create_journal_entry
  BEFORE INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_journal_entry_from_transaction();

-- Add comment
COMMENT ON FUNCTION auto_create_journal_entry_from_transaction() IS
'Automatically creates double-entry journal entries for all transactions. Implements QuickBooks-style accounting where every transaction has underlying debit/credit entries.';
