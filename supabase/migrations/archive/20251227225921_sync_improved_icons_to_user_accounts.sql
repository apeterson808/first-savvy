/*
  # Sync Improved Icons to User Accounts

  1. Changes
    - Update all user chart of accounts with new diverse icons from templates
    - Ensures consistent visual experience across all users
*/

UPDATE user_chart_of_accounts uca
SET icon = t.icon
FROM chart_of_accounts_templates t
WHERE uca.account_number = t.account_number;