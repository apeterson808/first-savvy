/*
  # Set Existing User Accounts to Inactive Based on Usage

  ## Overview
  Updates existing user_chart_of_accounts entries to be inactive by default, except for:
  - Accounts that have budgets
  - Accounts that are linked to bank accounts, credit cards, assets, liabilities, or equity
  - Accounts that have transactions

  ## Logic
  1. Set all accounts to inactive first
  2. Activate accounts that have budgets
  3. Activate accounts that are linked to real financial instruments
  4. Activate accounts that have transaction history
*/

-- Step 1: Set all user chart accounts to inactive
UPDATE user_chart_of_accounts
SET is_active = false, updated_at = now()
WHERE is_active = true;

-- Step 2: Activate accounts that have budgets
UPDATE user_chart_of_accounts
SET is_active = true, updated_at = now()
WHERE id IN (
  SELECT DISTINCT chart_account_id
  FROM budgets
  WHERE chart_account_id IS NOT NULL
);

-- Step 3: Activate accounts linked to bank accounts
UPDATE user_chart_of_accounts
SET is_active = true, updated_at = now()
WHERE id IN (
  SELECT DISTINCT chart_account_id
  FROM bank_accounts
  WHERE chart_account_id IS NOT NULL
);

-- Step 4: Activate accounts linked to transactional accounts
UPDATE user_chart_of_accounts
SET is_active = true, updated_at = now()
WHERE id IN (
  SELECT DISTINCT chart_account_id
  FROM accounts
  WHERE chart_account_id IS NOT NULL
);

-- Step 5: Activate accounts linked to credit cards
UPDATE user_chart_of_accounts
SET is_active = true, updated_at = now()
WHERE id IN (
  SELECT DISTINCT chart_account_id
  FROM credit_cards
  WHERE chart_account_id IS NOT NULL
);

-- Step 6: Activate accounts linked to assets
UPDATE user_chart_of_accounts
SET is_active = true, updated_at = now()
WHERE id IN (
  SELECT DISTINCT chart_account_id
  FROM assets
  WHERE chart_account_id IS NOT NULL
);

-- Step 7: Activate accounts linked to liabilities
UPDATE user_chart_of_accounts
SET is_active = true, updated_at = now()
WHERE id IN (
  SELECT DISTINCT chart_account_id
  FROM liabilities
  WHERE chart_account_id IS NOT NULL
);

-- Step 8: Activate accounts linked to equity
UPDATE user_chart_of_accounts
SET is_active = true, updated_at = now()
WHERE id IN (
  SELECT DISTINCT chart_account_id
  FROM equity
  WHERE chart_account_id IS NOT NULL
);

-- Step 9: Activate accounts that have transactions
UPDATE user_chart_of_accounts
SET is_active = true, updated_at = now()
WHERE id IN (
  SELECT DISTINCT chart_account_id
  FROM transactions
  WHERE chart_account_id IS NOT NULL
);
