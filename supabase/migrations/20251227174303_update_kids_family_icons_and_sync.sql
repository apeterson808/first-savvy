/*
  # Update Kids & Family Icons and Sync to Users

  ## Overview
  Updates the Kids & Family category icons to be more appropriate and family-friendly.

  ## Changes Made
  1. Updates Kids & Family (5600) icon from 'Sparkles' to 'Baby'
  2. Updates Childcare (5610) icon from 'Apple' to 'Heart'
  3. Syncs these changes to all existing user chart of accounts

  ## Impact
  - More semantically appropriate icons for family-related expenses
  - Better visual identification of Kids & Family categories
  - Changes immediately visible to all users
*/

-- Update template icons for Kids & Family categories
UPDATE chart_of_accounts_templates 
SET icon = 'Baby' 
WHERE account_number = 5600;

UPDATE chart_of_accounts_templates 
SET icon = 'Heart' 
WHERE account_number = 5610;

-- Sync to all user chart of accounts
UPDATE user_chart_of_accounts uca
SET icon = t.icon
FROM chart_of_accounts_templates t
WHERE uca.account_number = t.account_number
  AND uca.account_number IN (5600, 5610)
  AND t.icon IS NOT NULL;