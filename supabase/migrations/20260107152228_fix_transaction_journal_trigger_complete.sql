/*
  # Complete Fix for Transaction Journal Entry Trigger

  ## Problem
  The auto_create_journal_entry_from_transaction trigger has accumulated multiple issues:
  1. Wrong account lookup (account_name vs display_name vs template_account_number)
  2. No status gate (runs for pending transactions, should only run for posted)
  3. Missing income/expense logic (only looks for expense accounts)
  4. Missing bank_account_class variable declaration
  5. Doesn't set NEW.category_account_id (UI shows blank category)
  6. References dropped 'status' column in journal_entries INSERT

  ## Root Cause
  Multiple migrations attempted partial fixes but each introduced new issues:
  - 20260107135227: Used non-existent account_name column, removed status gate
  - 20260107150607: Fixed to display_name but wrong value ('Uncategorized' vs 'Uncategorized Expense')
  - 20260107134050: Dropped status column from journal_entries but trigger still uses it

  ## Complete Solution
  This migration restores the working logic from 20260107131337 with corrections:
  - Uses template_account_number (4999/9999) for reliable account lookup
  - Adds status gate: only creates journal entries when status = 'posted'
  - Determines income (4999) vs expense (9999) based on transaction type
  - Declares all required variables including v_bank_account_class
  - Sets NEW.category_account_id so UI shows "Uncategorized" properly
  - Removes status column from journal_entries INSERT (column was dropped)
  - Maintains source = 'system' for auto-generated entries

  ## Impact
  - Transaction imports will succeed (no longer fails on trigger)
  - Pending transactions won't create journal entries
  - Posted transactions will auto-create journal entries with proper uncategorized account
  - UI will display "Uncategorized Income" or "Uncategorized Expense" correctly
  - Account balances will update properly
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
  -- ============================================================================
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
'Automatically creates journal entries for posted transactions. Complete fix that:
- Only runs for posted transactions (status gate)
- Uses template_account_number (4999/9999) for uncategorized accounts
- Handles both income and expense transactions
- Sets category_account_id on transaction for UI display
- Properly declares all variables including bank_account_class
- Removes reference to dropped status column in journal_entries';
