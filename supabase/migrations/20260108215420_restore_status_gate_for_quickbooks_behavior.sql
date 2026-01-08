/*
  # Restore Status Gate for QuickBooks-Style Behavior

  ## Problem
  Migration 20260107154433 removed the status gate from the journal entry trigger,
  causing journal entries to be created immediately on import. This causes Savvy Balance
  to match Bank Balance immediately, when they should only match after posting.

  ## QuickBooks Behavior
  1. Transactions import as status='pending' (no journal entry created)
  2. User reviews and categorizes pending transactions
  3. User clicks "Post" button to change status='posted'
  4. Journal entry is created ONLY when status changes to 'posted'
  5. Savvy Balance reflects only posted transactions
  6. Bank Balance vs Savvy Balance difference shows pending transactions

  ## Solution
  Restore the status gate in the trigger:
  - On INSERT: Only create journal entry if status='posted'
  - On UPDATE: Only create journal entry if status changes to 'posted' OR category is added to already-posted transaction
  - Pending transactions remain in review queue without affecting accounting

  ## Impact
  - CSV imports with status='pending' will NOT create journal entries
  - Statement imports with status='pending' will NOT create journal entries
  - Only when user clicks "Post" button will journal entries be created
  - Savvy Balance will only include posted transactions
  - Pending transactions visible in UI but not in accounting records
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
BEGIN
  -- ============================================================================
  -- STEP 1: Determine if we should create a journal entry
  -- CRITICAL: Only create journal entries for POSTED transactions
  -- ============================================================================
  IF TG_OP = 'INSERT' THEN
    -- On INSERT: create entry if no journal_entry_id exists AND status is posted
    v_should_create_entry := (NEW.journal_entry_id IS NULL AND NEW.status = 'posted');
  ELSIF TG_OP = 'UPDATE' THEN
    -- On UPDATE: create entry if:
    -- 1. No journal_entry_id exists yet
    -- 2. AND (status just changed to posted OR category was added to already-posted transaction)
    v_should_create_entry := (
      NEW.journal_entry_id IS NULL AND (
        (OLD.status != 'posted' AND NEW.status = 'posted') OR
        (NEW.status = 'posted' AND OLD.category_account_id IS NULL AND NEW.category_account_id IS NOT NULL)
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

  -- ============================================================================
  -- STEP 2: Check if transaction has splits
  -- ============================================================================
  SELECT EXISTS(
    SELECT 1 FROM transaction_splits
    WHERE transaction_id = NEW.id
  ) INTO v_has_splits;

  -- ============================================================================
  -- STEP 3: Get bank account class for proper debit/credit determination
  -- ============================================================================
  SELECT class INTO v_bank_account_class
  FROM user_chart_of_accounts
  WHERE id = NEW.bank_account_id;

  -- ============================================================================
  -- STEP 4: Determine category account to use
  -- ============================================================================
  IF NEW.category_account_id IS NOT NULL THEN
    -- Category already assigned, use it
    v_category_account_id := NEW.category_account_id;

    SELECT class INTO v_category_account_class
    FROM user_chart_of_accounts
    WHERE id = v_category_account_id;
  ELSE
    -- No category assigned, use Uncategorized Income (4999) or Expense (9999)
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

    -- Raise error if uncategorized account not found
    IF v_category_account_id IS NULL THEN
      RAISE EXCEPTION 'Cannot create journal entry: Uncategorized account not found for profile_id %', NEW.profile_id;
    END IF;

    -- Assign the uncategorized account to the transaction for UI display
    NEW.category_account_id := v_category_account_id;
  END IF;

  -- ============================================================================
  -- STEP 5: Determine entry type
  -- ============================================================================
  IF NEW.source = 'opening_balance' THEN
    v_entry_type := 'opening_balance';
  ELSIF NEW.original_type = 'transfer' THEN
    v_entry_type := 'transfer';
  ELSE
    v_entry_type := 'adjustment';
  END IF;

  -- ============================================================================
  -- STEP 6: Generate journal entry number
  -- ============================================================================
  v_entry_number := generate_journal_entry_number(NEW.profile_id);

  -- ============================================================================
  -- STEP 7: Create journal entry header
  -- ============================================================================
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
    'system'
  )
  RETURNING id INTO v_journal_entry_id;

  -- ============================================================================
  -- STEP 8: Create journal entry lines
  -- ============================================================================
  v_line_number := 1;

  IF v_has_splits THEN
    -- =========================================================================
    -- Handle split transactions
    -- =========================================================================
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

    -- Credit/Debit the bank account (opposite of category)
    IF v_category_account_class IN ('expense', 'asset') THEN
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
        COALESCE(NEW.description, NEW.original_description)
      );
    ELSE
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
        COALESCE(NEW.description, NEW.original_description)
      );
    END IF;

  ELSE
    -- =========================================================================
    -- Handle non-split transactions
    -- =========================================================================

    -- Debit the category (expense/asset) or Credit (income/liability)
    IF v_category_account_class IN ('expense', 'asset') THEN
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
        COALESCE(NEW.description, NEW.original_description)
      );
      v_line_number := v_line_number + 1;

      -- Credit the bank account
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
        COALESCE(NEW.description, NEW.original_description)
      );
    ELSE
      -- Credit the category (income/liability)
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
        COALESCE(NEW.description, NEW.original_description)
      );
      v_line_number := v_line_number + 1;

      -- Debit the bank account
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
        COALESCE(NEW.description, NEW.original_description)
      );
    END IF;
  END IF;

  -- ============================================================================
  -- STEP 9: Link journal entry back to transaction
  -- ============================================================================
  NEW.journal_entry_id := v_journal_entry_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

COMMENT ON FUNCTION auto_create_journal_entry_from_transaction IS
'Automatically creates journal entries ONLY for posted transactions (QuickBooks-style behavior).
- Pending transactions do NOT create journal entries
- Journal entries only created when status changes to posted
- Uses template_account_number (4999/9999) for uncategorized accounts
- Handles both income and expense transactions
- Sets category_account_id on transaction for UI display';
