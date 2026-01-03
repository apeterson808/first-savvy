/*
  # Sync Icons and Colors to User Chart of Accounts

  ## Overview
  Updates all existing user_chart_of_accounts records with icon and color data from 
  the chart_of_accounts_templates table based on matching account_number.

  ## Changes
  - Updates icon and color fields for all user accounts that match template account_numbers
  - Ensures all users get the visual enhancements added to templates

  ## Impact
  - Existing user accounts will now display with appropriate icons and colors
  - No data loss - only adding visual metadata
*/

-- Update all user chart of accounts with icons and colors from templates
UPDATE user_chart_of_accounts uca
SET 
  icon = t.icon,
  color = t.color
FROM chart_of_accounts_templates t
WHERE uca.account_number = t.account_number
  AND (uca.icon IS NULL OR uca.color IS NULL OR uca.icon = '' OR uca.color = '');
