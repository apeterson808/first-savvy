/*
  # Fix Existing Backwards Journal Entries

  ## Issue
  Journal entries created before the trigger fix have backwards debits/credits.
  For expenses on asset accounts:
  - WRONG: Debit Asset, Credit Expense
  - CORRECT: Debit Expense, Credit Asset

  ## Fix Strategy
  1. Identify journal entries linked to expense transactions on asset accounts
  2. Swap the debit and credit amounts for those entries
  3. Recalculate account balances after the fix

  ## Safety
  - Only affects journal entries with linked transactions
  - Preserves entry numbers and dates
  - Maintains double-entry bookkeeping balance
*/

-- Step 1: Identify and fix backwards expense entries on asset accounts
DO $$
DECLARE
  v_entry record;
  v_fixed_count integer := 0;
BEGIN
  RAISE NOTICE 'Fixing backwards journal entries...';

  FOR v_entry IN
    SELECT DISTINCT
      je.id as entry_id,
      je.entry_number,
      t.type as transaction_type,
      t.amount as transaction_amount,
      bank_acct.class as bank_class
    FROM journal_entries je
    JOIN transactions t ON t.journal_entry_id = je.id
    JOIN user_chart_of_accounts bank_acct ON t.bank_account_id = bank_acct.id
    WHERE t.type = 'expense'
    AND bank_acct.class = 'asset'
    AND je.entry_type != 'opening_balance'
  LOOP
    -- Swap debits and credits for this entry
    UPDATE journal_entry_lines
    SET 
      debit_amount = credit_amount,
      credit_amount = debit_amount
    WHERE journal_entry_id = v_entry.entry_id;

    v_fixed_count := v_fixed_count + 1;
    RAISE NOTICE 'Fixed entry %: % (transaction type: %)', 
      v_entry.entry_number, v_entry.entry_id, v_entry.transaction_type;
  END LOOP;

  RAISE NOTICE 'Fixed % journal entries', v_fixed_count;
END $$;

-- Step 2: Fix backwards income entries on asset accounts (if any)
DO $$
DECLARE
  v_entry record;
  v_asset_line record;
  v_category_line record;
  v_needs_fix boolean;
  v_fixed_count integer := 0;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Checking income entries on asset accounts...';

  FOR v_entry IN
    SELECT DISTINCT
      je.id as entry_id,
      je.entry_number,
      t.type as transaction_type,
      t.bank_account_id,
      t.category_account_id
    FROM journal_entries je
    JOIN transactions t ON t.journal_entry_id = je.id
    JOIN user_chart_of_accounts bank_acct ON t.bank_account_id = bank_acct.id
    WHERE t.type = 'income'
    AND bank_acct.class = 'asset'
    AND je.entry_type != 'opening_balance'
  LOOP
    v_needs_fix := false;

    -- Check if asset account was credited (should be debited for income)
    SELECT * INTO v_asset_line
    FROM journal_entry_lines
    WHERE journal_entry_id = v_entry.entry_id
    AND account_id = v_entry.bank_account_id
    LIMIT 1;

    IF v_asset_line.credit_amount IS NOT NULL THEN
      v_needs_fix := true;
    END IF;

    IF v_needs_fix THEN
      -- Swap debits and credits for this entry
      UPDATE journal_entry_lines
      SET 
        debit_amount = credit_amount,
        credit_amount = debit_amount
      WHERE journal_entry_id = v_entry.entry_id;

      v_fixed_count := v_fixed_count + 1;
      RAISE NOTICE 'Fixed income entry %', v_entry.entry_number;
    END IF;
  END LOOP;

  RAISE NOTICE 'Fixed % income entries', v_fixed_count;
END $$;

-- Step 3: Validate all entries are now balanced
DO $$
DECLARE
  v_imbalanced_count integer;
BEGIN
  RAISE NOTICE '';
  RAISE NOTICE 'Validating entry balances...';

  SELECT COUNT(*) INTO v_imbalanced_count
  FROM journal_entries je
  WHERE ABS(
    COALESCE((SELECT SUM(debit_amount) FROM journal_entry_lines WHERE journal_entry_id = je.id), 0) -
    COALESCE((SELECT SUM(credit_amount) FROM journal_entry_lines WHERE journal_entry_id = je.id), 0)
  ) > 0.01;

  IF v_imbalanced_count > 0 THEN
    RAISE WARNING 'Found % imbalanced entries after fix!', v_imbalanced_count;
  ELSE
    RAISE NOTICE 'All journal entries are balanced ✓';
  END IF;
END $$;

COMMENT ON FUNCTION auto_create_journal_entry_from_transaction() IS
'Fixed trigger that uses transaction type instead of amount sign';
