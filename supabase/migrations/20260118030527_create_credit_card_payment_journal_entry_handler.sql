/*
  # Create Credit Card Payment Journal Entry Handler

  ## Overview
  Creates journal entries for credit card payment transactions following proper
  accounting principles for liability reduction.

  ## Accounting Treatment
  When a credit card payment is made:
  - DR Credit Card (Liability Account) - reduces the amount owed
  - CR Bank Account (Asset Account) - reduces cash/checking balance
  - Both lines use "Credit Card Payment" as the description

  ## Key Functions
  1. `create_credit_card_payment_journal_entry()` - Creates journal entry for a payment pair
  2. Updates `auto_create_journal_entry_from_transaction()` - Adds credit card payment handling

  ## Integration with Existing System
  - Similar to transfer handling but specific to liability account payments
  - Uses cc_payment_pair_id to link transactions
  - Sets entry_type to 'credit_card_payment'
  - Prevents duplicate entries for same payment pair
*/

-- ============================================================================
-- STEP 1: Create credit card payment journal entry function
-- ============================================================================

CREATE OR REPLACE FUNCTION create_credit_card_payment_journal_entry(
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
  v_bank_account_id uuid;
  v_credit_card_account_id uuid;
  v_amount numeric;
  v_description text;
BEGIN
  -- Get the transaction
  SELECT * INTO v_transaction
  FROM transactions
  WHERE id = p_transaction_id;

  -- If no cc_payment_pair_id, this isn't a credit card payment
  IF v_transaction.cc_payment_pair_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Find the paired transaction
  SELECT * INTO v_paired_transaction
  FROM transactions
  WHERE cc_payment_pair_id = v_transaction.cc_payment_pair_id
    AND id != p_transaction_id
    AND profile_id = p_profile_id;

  -- If paired transaction doesn't exist yet, we'll create entry when it's posted
  IF v_paired_transaction.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check if journal entry already exists for this payment pair
  IF v_transaction.journal_entry_id IS NOT NULL THEN
    RETURN v_transaction.journal_entry_id;
  END IF;

  IF v_paired_transaction.journal_entry_id IS NOT NULL THEN
    RETURN v_paired_transaction.journal_entry_id;
  END IF;

  -- Determine which is bank account and which is credit card
  -- Bank transaction has negative amount (withdrawal)
  -- Credit card transaction has positive amount (payment reduces liability)
  IF v_transaction.amount < 0 THEN
    -- This transaction is the bank withdrawal
    v_bank_account_id := v_transaction.bank_account_id;
    v_credit_card_account_id := v_paired_transaction.bank_account_id;
    v_amount := ABS(v_transaction.amount);
    v_description := COALESCE(v_transaction.description, v_transaction.original_description, 'Credit card payment');
  ELSE
    -- This transaction is the credit card payment
    v_credit_card_account_id := v_transaction.bank_account_id;
    v_bank_account_id := v_paired_transaction.bank_account_id;
    v_amount := ABS(v_transaction.amount);
    v_description := COALESCE(v_transaction.description, v_transaction.original_description, 'Credit card payment');
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
    'credit_card_payment',
    COALESCE(v_transaction.source, 'system')
  )
  RETURNING id INTO v_journal_entry_id;

  -- Create journal entry line 1: DEBIT credit card (reduces liability)
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
    v_credit_card_account_id,
    1,
    v_amount,
    NULL,
    'Credit Card Payment'
  );

  -- Create journal entry line 2: CREDIT bank account (reduces cash)
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
    v_bank_account_id,
    2,
    NULL,
    v_amount,
    'Credit Card Payment'
  );

  -- Link BOTH transactions to this journal entry
  UPDATE transactions
  SET journal_entry_id = v_journal_entry_id
  WHERE id IN (v_transaction.id, v_paired_transaction.id);

  RETURN v_journal_entry_id;
END;
$$;

COMMENT ON FUNCTION create_credit_card_payment_journal_entry IS
'Creates a single journal entry for a credit card payment pair, linking both transactions.
Implements proper accounting: DR Credit Card (Liability), CR Bank Account (Asset).
Both lines show "Credit Card Payment" as the description.
Only creates one entry per pair, preventing duplicates.';

-- ============================================================================
-- STEP 2: Update main trigger to handle credit card payments
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

  -- ============================================================================
  -- STEP 2: Handle credit card payments (NEW LOGIC)
  -- ============================================================================
  IF NEW.cc_payment_pair_id IS NOT NULL AND NEW.type = 'credit_card_payment' THEN
    v_journal_entry_id := create_credit_card_payment_journal_entry(
      NEW.id,
      NEW.profile_id,
      NEW.user_id
    );

    IF v_journal_entry_id IS NOT NULL THEN
      NEW.journal_entry_id := v_journal_entry_id;
    END IF;

    RETURN NEW;
  END IF;

  -- ============================================================================
  -- STEP 3: Handle transfers
  -- ============================================================================
  IF NEW.transfer_pair_id IS NOT NULL AND NEW.type = 'transfer' THEN
    v_journal_entry_id := create_transfer_journal_entry(
      NEW.id,
      NEW.profile_id,
      NEW.user_id
    );

    IF v_journal_entry_id IS NOT NULL THEN
      NEW.journal_entry_id := v_journal_entry_id;
    END IF;

    RETURN NEW;
  END IF;

  -- ============================================================================
  -- STEP 4: Check if transaction has splits
  -- ============================================================================
  SELECT EXISTS(
    SELECT 1 FROM transaction_splits
    WHERE transaction_id = NEW.id
  ) INTO v_has_splits;

  -- ============================================================================
  -- STEP 5: Get bank account class for proper debit/credit determination
  -- ============================================================================
  SELECT class INTO v_bank_account_class
  FROM user_chart_of_accounts
  WHERE id = NEW.bank_account_id;

  -- ============================================================================
  -- STEP 6: Determine category account to use
  -- ============================================================================
  IF NEW.category_account_id IS NOT NULL THEN
    v_category_account_id := NEW.category_account_id;

    SELECT class INTO v_category_account_class
    FROM user_chart_of_accounts
    WHERE id = v_category_account_id;
  ELSE
    IF NEW.type = 'income' OR (NEW.type = 'expense' AND NEW.amount < 0) THEN
      SELECT id, class INTO v_category_account_id, v_category_account_class
      FROM user_chart_of_accounts
      WHERE profile_id = NEW.profile_id
        AND template_account_number = 4999
      LIMIT 1;
    ELSE
      SELECT id, class INTO v_category_account_id, v_category_account_class
      FROM user_chart_of_accounts
      WHERE profile_id = NEW.profile_id
        AND template_account_number = 9999
      LIMIT 1;
    END IF;

    IF v_category_account_id IS NULL THEN
      RAISE EXCEPTION 'Cannot create journal entry: Uncategorized account not found for profile_id %', NEW.profile_id;
    END IF;

    NEW.category_account_id := v_category_account_id;
  END IF;

  -- ============================================================================
  -- STEP 7: Determine entry type
  -- ============================================================================
  IF NEW.source = 'opening_balance' THEN
    v_entry_type := 'opening_balance';
  ELSIF NEW.original_type = 'transfer' THEN
    v_entry_type := 'transfer';
  ELSE
    v_entry_type := 'adjustment';
  END IF;

  -- ============================================================================
  -- STEP 8: Generate journal entry number
  -- ============================================================================
  v_entry_number := generate_journal_entry_number(NEW.profile_id);

  -- ============================================================================
  -- STEP 9: Create journal entry header
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
  -- STEP 10: Create journal entry lines
  -- ============================================================================
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

  NEW.journal_entry_id := v_journal_entry_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

COMMENT ON FUNCTION auto_create_journal_entry_from_transaction IS
'Automatically creates journal entries for posted transactions, including credit card payments and transfers.
Complete implementation that:
- Creates journal entries for credit card payments using create_credit_card_payment_journal_entry()
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
