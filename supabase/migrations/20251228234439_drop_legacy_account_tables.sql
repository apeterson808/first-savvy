/*
  # Drop Legacy Account Tables

  ## Overview
  Remove old account tables now that all data has been consolidated into user_chart_of_accounts.
  This migration removes redundant tables and cleans up foreign key references.

  ## Tables Being Dropped
  - accounts (transactional accounts)
  - assets (asset accounts)
  - liabilities (liability accounts)
  - equity (equity accounts)
  - bank_accounts (legacy banking)
  - credit_cards (legacy credit cards)

  ## Foreign Keys Being Removed
  - transactions.bank_account_id (superseded by chart_account_id)
  - transactions.account_id (superseded by chart_account_id)

  ## Important Notes
  - All data has been migrated to user_chart_of_accounts
  - All queries should now use chart_account_id
  - Views are available for convenience filtering
*/

-- Drop foreign key column from transactions
ALTER TABLE transactions
DROP COLUMN IF EXISTS bank_account_id CASCADE;

ALTER TABLE transactions
DROP COLUMN IF EXISTS account_id CASCADE;

-- Drop asset_liability_links table (references old tables)
DROP TABLE IF EXISTS asset_liability_links CASCADE;

-- Drop old account tables
DROP TABLE IF EXISTS bank_accounts CASCADE;
DROP TABLE IF EXISTS credit_cards CASCADE;
DROP TABLE IF EXISTS accounts CASCADE;
DROP TABLE IF EXISTS assets CASCADE;
DROP TABLE IF EXISTS liabilities CASCADE;
DROP TABLE IF EXISTS equity CASCADE;
