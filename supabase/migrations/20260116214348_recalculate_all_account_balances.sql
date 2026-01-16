/*
  # Recalculate All Account Balances from Journal Entries
  
  1. Purpose
    - Fix accounts that have current_balance = 0 due to a bug in the account edit form
    - Recalculate all balances from journal entry lines
  
  2. Process
    - Update all user_chart_of_accounts records
    - Call recalculate_account_balance function for each account
    - This will sum up all debits and credits from journal entries
  
  3. Safety
    - Only updates accounts that exist
    - Uses existing recalculate_account_balance function
    - No data loss, only recalculation
*/

-- Recalculate balances for all accounts
UPDATE user_chart_of_accounts
SET current_balance = recalculate_account_balance(id)
WHERE id IS NOT NULL;
