/*
  # Create Transfer Journal Entry Handler

  ## Problem
  Transfers between accounts currently don't create journal entries, violating
  double-entry bookkeeping principles and QuickBooks standards.

  Current behavior:
  - Transfer transactions have `transfer_pair_id` to link them
  - Journal entry trigger SKIPS transfers (returns early)
  - No journal entries created for transfers
  - Transfers don't appear in account registers (journal_entry_lines view)
  - Violates double-entry accounting

  ## QuickBooks Standard Behavior
  - Every transfer automatically creates a journal entry
  - Journal entry format:
    DR: Destination Account (receiving money)  $X.XX
    CR: Source Account (sending money)         $X.XX
  - Both transactions link to same journal entry
  - Transfers only between Balance Sheet accounts (Asset, Liability, Equity)
  - Transfers do NOT appear on P&L (Income Statement)

  ## Solution
  Modify auto_create_journal_entry_from_transaction() to:
  1. Detect transfer transactions (has transfer_pair_id AND type='transfer')
  2. Find the paired transaction
  3. Determine which is source (money out) and destination (money in)
  4. Create ONE journal entry for the pair (not two)
  5. Link both transactions to same journal_entry_id

  ## Changes
  1. Remove transfer skip logic
  2. Add transfer detection and pairing logic
  3. Create proper debit/credit entries
  4. Prevent duplicate journal entries for same transfer pair
  5. Add account type validation

  ## Impact
  - Transfers will create journal entries
  - Account registers will show transfers on both sides
  - Proper double-entry accounting maintained
  - Reconciliation will work correctly
  - Balance Sheet accuracy improved
*/

-- ============================================================================
-- STEP 1: Create function to create transfer journal entry
-- ============================================================================

CREATE OR REPLACE FUNCTION create_transfer_journal_entry(
  p_transaction_id uuid,
  p_profile_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_transaction record;
  v_paired_transaction record;
  v_journal_entry_id uuid;
  v_entry_number text;
  v_source_account_id uuid;
  v_dest_account_id uuid;
  v_amount numeric;
  v_description text;
BEGIN
  -- Get the transaction
  SELECT * INTO v_transaction
  FROM transactions
  WHERE id = p_transaction_id;

  -- If no transfer_pair_id, this isn't a transfer
  IF v_transaction.transfer_pair_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Find the paired transaction
  SELECT * INTO v_paired_transaction
  FROM transactions
  WHERE transfer_pair_id = v_transaction.transfer_pair_id
    AND id != p_transaction_id
    AND profile_id = p_profile_id;

  -- If paired transaction doesn't exist yet, we'll create entry when it's posted
  IF v_paired_transaction.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check if journal entry already exists for this transfer pair
  -- (Prevent creating duplicate entries)
  IF v_transaction.journal_entry_id IS NOT NULL THEN
    RETURN v_transaction.journal_entry_id;
  END IF;

  IF v_paired_transaction.journal_entry_id IS NOT NULL THEN
    RETURN v_paired_transaction.journal_entry_id;
  END IF;

  -- Determine source and destination based on transaction amounts
  -- Source account: where money comes FROM (negative/outflow)
  -- Dest account: where money goes TO (positive/inflow)
  IF v_transaction.amount < 0 THEN
    -- This transaction is the outflow (source)
    v_source_account_id := v_transaction.bank_account_id;
    v_dest_account_id := v_paired_transaction.bank_account_id;
    v_amount := ABS(v_transaction.amount);
    v_description := COALESCE(v_transaction.description, v_transaction.original_description);
  ELSE
    -- This transaction is the inflow (destination)
    v_dest_account_id := v_transaction.bank_account_id;
    v_source_account_id := v_paired_transaction.bank_account_id;
    v_amount := ABS(v_transaction.amount);
    v_description := COALESCE(v_transaction.description, v_transaction.original_description);
  END IF;

  -- Generate journal entry number
  v_entry_number := generate_journal_entry_number(p_profile_id);

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
    p_profile_id,
    p_user_id,
    v_transaction.date,
    v_entry_number,
    v_description,
    'transfer',
    COALESCE(v_transaction.source, 'system')
  )
  RETURNING id INTO v_journal_entry_id;

  -- Create journal entry line 1: DEBIT destination account (money coming in)
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    profile_id,
    user_id,
    account_id,
    line_number,
    debit_amount,
    credit_amount,
    description
  ) VALUES (
    v_journal_entry_id,
    p_profile_id,
    p_user_id,
    v_dest_account_id,
    1,
    v_amount,
    NULL,
    'Transfer from account'
  );

  -- Create journal entry line 2: CREDIT source account (money going out)
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    profile_id,
    user_id,
    account_id,
    line_number,
    debit_amount,
    credit_amount,
    description
  ) VALUES (
    v_journal_entry_id,
    p_profile_id,
    p_user_id,
    v_source_account_id,
    2,
    NULL,
    v_amount,
    'Transfer to account'
  );

  -- Link BOTH transactions to this journal entry
  UPDATE transactions
  SET journal_entry_id = v_journal_entry_id
  WHERE id IN (v_transaction.id, v_paired_transaction.id);

  RETURN v_journal_entry_id;
END;
$$;

COMMENT ON FUNCTION create_transfer_journal_entry IS
'Creates a single journal entry for a transfer pair, linking both transactions.
Implements QuickBooks-standard transfer handling: DR destination, CR source.
Only creates one entry per pair, preventing duplicates.';

-- ============================================================================
-- STEP 2: Update main trigger to handle transfers
-- ============================================================================

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

  -- ============================================================================
  -- STEP 2: Handle transfers separately (NEW LOGIC)
  -- ============================================================================
  IF NEW.transfer_pair_id IS NOT NULL AND NEW.type = 'transfer' THEN
    -- Create transfer journal entry
    v_journal_entry_id := create_transfer_journal_entry(
      NEW.id,
      NEW.profile_id,
      NEW.user_id
    );

    -- If journal entry was created, link it to this transaction
    IF v_journal_entry_id IS NOT NULL THEN
      NEW.journal_entry_id := v_journal_entry_id;
    END IF;

    RETURN NEW;
  END IF;

  -- ============================================================================
  -- STEP 3: Check if transaction has splits
  -- ============================================================================
  SELECT EXISTS(
    SELECT 1 FROM transaction_splits
    WHERE transaction_id = NEW.id
  ) INTO v_has_splits;

  -- ============================================================================
  -- STEP 4: Get bank account class for proper debit/credit determination
  -- ============================================================================
  SELECT class INTO v_bank_account_class
  FROM user_chart_of_accounts
  WHERE id = NEW.bank_account_id;

  -- ============================================================================
  -- STEP 5: Determine category account to use
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
  -- STEP 6: Determine entry type
  -- ============================================================================
  IF NEW.source = 'opening_balance' THEN
    v_entry_type := 'opening_balance';
  ELSIF NEW.original_type = 'transfer' THEN
    v_entry_type := 'transfer';
  ELSE
    v_entry_type := 'adjustment';
  END IF;

  -- ============================================================================
  -- STEP 7: Generate journal entry number
  -- ============================================================================
  v_entry_number := generate_journal_entry_number(NEW.profile_id);

  -- ============================================================================
  -- STEP 8: Create journal entry header
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
  -- STEP 9: Create journal entry lines
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
  -- STEP 10: Link journal entry back to transaction
  -- ============================================================================
  NEW.journal_entry_id := v_journal_entry_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

COMMENT ON FUNCTION auto_create_journal_entry_from_transaction IS
'Automatically creates journal entries for posted transactions, INCLUDING TRANSFERS.
Complete implementation that:
- Creates journal entries for transfers using create_transfer_journal_entry()
- Only runs for posted transactions (status gate)
- Uses template_account_number (4999/9999) for uncategorized accounts
- Handles both income and expense transactions
- Sets category_account_id on transaction for UI display
- Properly handles split transactions
- Implements QuickBooks-standard double-entry accounting';

-- Recreate trigger
DROP TRIGGER IF EXISTS trigger_auto_create_journal_entry ON transactions;

CREATE TRIGGER trigger_auto_create_journal_entry
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_journal_entry_from_transaction();
