/*
  # Provision Uncategorized Accounts for Existing Users

  ## Overview
  Provisions the new uncategorized income (4999) and expense (9999) accounts for all
  existing users who don't already have them.

  ## Changes
  - Adds account 4999 (Uncategorized Income) to all user profiles
  - Adds account 9999 (Uncategorized Expense) to all user profiles
  - Sets accounts as ACTIVE and system-created

  ## Security
  Direct INSERT allowed since this is a one-time migration
*/

-- Provision Uncategorized Income (4999) for all existing profiles
INSERT INTO user_chart_of_accounts (
  profile_id,
  template_account_number,
  account_number,
  display_name,
  class,
  account_detail,
  account_type,
  icon,
  color,
  is_active,
  is_user_created
)
SELECT
  p.id,
  4999,
  4999,
  'Uncategorized Income',
  'income',
  'uncategorized',
  'uncategorized',
  'HelpCircle',
  '#9ca3af',
  true,
  false
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM user_chart_of_accounts
  WHERE profile_id = p.id AND template_account_number = 4999
);

-- Provision Uncategorized Expense (9999) for all existing profiles
INSERT INTO user_chart_of_accounts (
  profile_id,
  template_account_number,
  account_number,
  display_name,
  class,
  account_detail,
  account_type,
  icon,
  color,
  is_active,
  is_user_created
)
SELECT
  p.id,
  9999,
  9999,
  'Uncategorized Expense',
  'expense',
  'uncategorized',
  'uncategorized',
  'HelpCircle',
  '#9ca3af',
  true,
  false
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM user_chart_of_accounts
  WHERE profile_id = p.id AND template_account_number = 9999
);
