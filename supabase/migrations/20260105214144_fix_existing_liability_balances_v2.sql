/*
  # Fix Existing Liability Balances

  1. Changes
    - Convert all negative liability balances to positive (QuickBooks convention)
    - Recalculate all account balances from journal entries
    - Update any accounts that have journal entries

  2. Logic
    - For LIABILITY accounts: positive = amount owed
    - Recalculate all balances from posted journal entries
    - This ensures consistency with the new trigger system

  3. Important Notes
    - This migration is idempotent - can be run multiple times safely
    - Only affects accounts that have journal entries
    - Preserves data integrity by recalculating from source journal entries
*/

-- Recalculate balances for all accounts that have journal entries
DO $$
DECLARE
  v_account_record RECORD;
  v_new_balance numeric;
BEGIN
  -- Loop through all accounts that have journal entry lines
  FOR v_account_record IN
    SELECT DISTINCT ucoa.id, ucoa.class, ucoa.display_name
    FROM user_chart_of_accounts ucoa
    INNER JOIN journal_entry_lines jel ON jel.account_id = ucoa.id
    INNER JOIN journal_entries je ON je.id = jel.journal_entry_id
    WHERE je.status = 'posted'
  LOOP
    -- Recalculate balance using the new function
    v_new_balance := recalculate_account_balance(v_account_record.id);
    
    -- Update the account balance
    UPDATE user_chart_of_accounts
    SET current_balance = v_new_balance
    WHERE id = v_account_record.id;
    
    RAISE NOTICE 'Updated account % (%) - new balance: %', 
      v_account_record.display_name, 
      v_account_record.class, 
      v_new_balance;
  END LOOP;
END $$;

-- For any liability accounts without journal entries but with negative balances,
-- flip them to positive (this handles manually created accounts)
UPDATE user_chart_of_accounts
SET current_balance = ABS(current_balance)
WHERE class = 'liability'
  AND current_balance < 0
  AND NOT EXISTS (
    SELECT 1 FROM journal_entry_lines jel
    WHERE jel.account_id = user_chart_of_accounts.id
  );
