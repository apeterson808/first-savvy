/*
  # Fix Uncategorized Category Assignment on Transactions

  ## Overview
  Updates the journal entry trigger to set `category_account_id` on the transaction record
  when using uncategorized accounts as fallback. This ensures the UI displays "Uncategorized Income"
  or "Uncategorized Expense" instead of showing blank.

  ## Problem
  - Trigger determines correct uncategorized account (4999 or 9999)
  - Journal entry is created with correct account
  - BUT transaction.category_account_id remains NULL
  - UI shows blank because it reads from transaction.category_account_id

  ## Solution
  After determining v_category_account_id (whether assigned or uncategorized fallback),
  set NEW.category_account_id := v_category_account_id before creating journal entry.

  ## Changes
  1. Update trigger function to assign category_account_id on transaction
  2. Backfill existing transactions that have journal entries but NULL category_account_id
*/

-- Update the trigger function
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
  v_category_account_id uuid;
  v_has_splits boolean;
  v_split_record record;
  v_line_number integer;
  v_should_create_entry boolean := false;
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

    -- If uncategorized account not found, skip (shouldn't happen but safety check)
    IF v_category_account_id IS NULL THEN
      RETURN NEW;
    END IF;

    -- **FIX: Set category_account_id on transaction record**
    -- This ensures the UI shows "Uncategorized Income/Expense" instead of blank
    NEW.category_account_id := v_category_account_id;
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
      -- Get the split category class
      SELECT class INTO v_category_account_class
      FROM user_chart_of_accounts
      WHERE id = v_split_record.category_account_id;

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
      -- Debit bank account (liability - paying down)
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
    -- No splits - use determined category_account_id (could be assigned or uncategorized)
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
        v_category_account_id,
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
        v_category_account_id,
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

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_auto_create_journal_entry ON transactions;
CREATE TRIGGER trigger_auto_create_journal_entry
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_journal_entry_from_transaction();

COMMENT ON TRIGGER trigger_auto_create_journal_entry ON transactions IS
'Automatically creates journal entries when transactions are posted. Uses uncategorized accounts as fallback when no category is assigned, ensuring accurate account balances.';

-- Backfill existing transactions
-- Find transactions that have journal entries but NULL category_account_id
-- Match them to the uncategorized account used in their journal entry
UPDATE transactions t
SET category_account_id = (
  SELECT jel.account_id
  FROM journal_entry_lines jel
  INNER JOIN user_chart_of_accounts uca ON jel.account_id = uca.id
  WHERE jel.journal_entry_id = t.journal_entry_id
    AND uca.template_account_number IN (4999, 9999)
  LIMIT 1
)
WHERE t.journal_entry_id IS NOT NULL
  AND t.category_account_id IS NULL
  AND t.transfer_pair_id IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM transaction_splits
    WHERE transaction_id = t.id
  );