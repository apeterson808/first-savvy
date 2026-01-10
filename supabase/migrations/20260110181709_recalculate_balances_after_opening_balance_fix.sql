/*
  # Recalculate Account Balances After Opening Balance Fix

  ## Purpose
  After fixing duplicate opening balance entries, we need to recalculate balances
  for all affected accounts to ensure they reflect the corrected journal entries.

  ## What This Does
  1. Recalculates current_balance for all accounts based on journal entry lines
  2. Uses proper debit/credit logic based on account type
  3. Updates the user_chart_of_accounts table with correct balances

  ## Impact
  - Account balances will be accurate
  - Registers will show correct running balances
  - Financial reports will be correct
*/

DO $$
DECLARE
  v_account RECORD;
  v_calculated_balance numeric;
BEGIN
  RAISE NOTICE 'Recalculating balances for all accounts...';

  FOR v_account IN
    SELECT 
      id, 
      profile_id, 
      account_number, 
      display_name,
      account_type,
      current_balance
    FROM user_chart_of_accounts
    WHERE is_active = true
    ORDER BY account_number
  LOOP
    -- Calculate balance based on journal entry lines
    -- Assets and Expenses: Debits increase, Credits decrease
    -- Liabilities, Equity, Income: Credits increase, Debits decrease
    IF v_account.account_type IN ('asset', 'expense') THEN
      SELECT COALESCE(SUM(COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0)), 0)
      INTO v_calculated_balance
      FROM journal_entry_lines
      WHERE account_id = v_account.id;
    ELSE
      SELECT COALESCE(SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)), 0)
      INTO v_calculated_balance
      FROM journal_entry_lines
      WHERE account_id = v_account.id;
    END IF;

    -- Only update if balance changed
    IF v_calculated_balance != v_account.current_balance THEN
      UPDATE user_chart_of_accounts
      SET current_balance = v_calculated_balance
      WHERE id = v_account.id;

      RAISE NOTICE 'Account % (%): % → %',
        v_account.account_number,
        COALESCE(v_account.display_name, 'Unknown'),
        v_account.current_balance,
        v_calculated_balance;
    END IF;
  END LOOP;

  RAISE NOTICE 'Balance recalculation complete';
END $$;
