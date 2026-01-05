/*
  # Consolidate Duplicate Credit Card Accounts

  ## Problem
  Due to a bug in activate_template_account, users got account 2001 instead of 2000
  for their first credit card. This migration consolidates them.

  ## Solution
  - Copy data from account 2001 to account 2000
  - Move all transactions from 2001 to 2000
  - Delete account 2001
  - Result: First credit card is at 2000 as expected

  ## Safety
  - Only affects accounts where both 2000 and 2001 exist
  - Preserves all transaction data
*/

DO $$
DECLARE
  v_profile_id uuid;
  v_account_2000_id uuid;
  v_account_2001_id uuid;
  v_transaction_count integer;
BEGIN
  -- Loop through each profile that has both accounts
  FOR v_profile_id, v_account_2000_id, v_account_2001_id IN
    SELECT 
      a2000.profile_id,
      a2000.id as account_2000_id,
      a2001.id as account_2001_id
    FROM user_chart_of_accounts a2000
    INNER JOIN user_chart_of_accounts a2001
      ON a2000.profile_id = a2001.profile_id
    WHERE a2000.account_number = 2000
      AND a2001.account_number = 2001
      AND a2000.template_account_number = 2000
      AND a2001.template_account_number = 2000
  LOOP
    -- Update account 2000 with data from 2001
    UPDATE user_chart_of_accounts
    SET
      display_name = (SELECT display_name FROM user_chart_of_accounts WHERE id = v_account_2001_id),
      current_balance = (SELECT current_balance FROM user_chart_of_accounts WHERE id = v_account_2001_id),
      available_balance = (SELECT available_balance FROM user_chart_of_accounts WHERE id = v_account_2001_id),
      statement_balance = (SELECT statement_balance FROM user_chart_of_accounts WHERE id = v_account_2001_id),
      institution_name = (SELECT institution_name FROM user_chart_of_accounts WHERE id = v_account_2001_id),
      account_number_last4 = (SELECT account_number_last4 FROM user_chart_of_accounts WHERE id = v_account_2001_id),
      credit_limit = (SELECT credit_limit FROM user_chart_of_accounts WHERE id = v_account_2001_id),
      interest_rate = (SELECT interest_rate FROM user_chart_of_accounts WHERE id = v_account_2001_id),
      minimum_payment = (SELECT minimum_payment FROM user_chart_of_accounts WHERE id = v_account_2001_id),
      payment_due_date = (SELECT payment_due_date FROM user_chart_of_accounts WHERE id = v_account_2001_id),
      statement_closing_date = (SELECT statement_closing_date FROM user_chart_of_accounts WHERE id = v_account_2001_id),
      is_active = true,
      updated_at = now()
    WHERE id = v_account_2000_id;

    -- Move all transactions from 2001 to 2000
    UPDATE transactions
    SET bank_account_id = v_account_2000_id
    WHERE bank_account_id = v_account_2001_id;

    -- Get count for logging
    GET DIAGNOSTICS v_transaction_count = ROW_COUNT;

    -- Delete account 2001
    DELETE FROM user_chart_of_accounts
    WHERE id = v_account_2001_id;

    RAISE NOTICE 'Consolidated accounts for profile %. Moved % transactions from 2001 to 2000.', 
      v_profile_id, v_transaction_count;
  END LOOP;
END $$;
