/*
  # Deactivate Unused Accounts for Existing Users

  ## Overview
  Deactivates unused Asset/Liability/Equity accounts for existing users to clean up
  their account lists. This migration only affects accounts that have never been used.

  ## What Gets Deactivated
  Asset/Liability/Equity accounts (account numbers 1000-3200) that meet ALL criteria:
  - current_balance is 0 or NULL
  - No transactions linked (via bank_account_id or category_account_id)
  - Not a system equity account (3000, 3200)

  ## What Stays Active
  - All Income accounts (4000-4260)
  - All Expense accounts (6000-9000)
  - Accounts with non-zero balance
  - Accounts with any transactions
  - System equity accounts
  - User-created accounts

  ## Safety
  This migration is safe because:
  - Only deactivates truly unused accounts
  - Users can reactivate accounts through the wizard if needed
  - Does not delete any data
*/

-- Deactivate unused Asset/Liability/Equity accounts
UPDATE user_chart_of_accounts
SET 
  is_active = false,
  updated_at = now()
WHERE 
  -- Only Asset/Liability/Equity accounts
  account_number >= 1000 
  AND account_number < 4000
  -- Not system equity accounts
  AND template_account_number NOT IN (3000, 3200)
  -- Only template accounts (not user-created)
  AND is_user_created = false
  -- Zero or null balance
  AND (current_balance IS NULL OR current_balance = 0)
  -- No transactions linked
  AND NOT EXISTS (
    SELECT 1 FROM transactions
    WHERE bank_account_id = user_chart_of_accounts.id
       OR category_account_id = user_chart_of_accounts.id
  )
  -- Currently active (don't update already inactive)
  AND is_active = true;