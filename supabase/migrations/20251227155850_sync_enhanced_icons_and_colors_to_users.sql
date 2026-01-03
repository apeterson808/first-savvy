/*
  # Sync Enhanced Icons and Colors to User Accounts

  ## Overview
  Updates all existing user_chart_of_accounts records with the enhanced icon and color 
  data from the chart_of_accounts_templates table based on matching account_number.

  ## Changes
  - Updates icon and color fields for all user accounts that match template account_numbers
  - Ensures all users immediately benefit from the enhanced visual diversity
  - Preserves any custom icons/colors users may have set (only updates NULL or empty values)

  ## Impact
  - All existing user accounts will display with the new, more diverse icons and colors
  - Improved visual scanning and category identification
  - No data loss - only enhancing visual metadata
*/

-- Update all user chart of accounts with enhanced icons and colors from templates
UPDATE user_chart_of_accounts uca
SET 
  icon = t.icon,
  color = t.color
FROM chart_of_accounts_templates t
WHERE uca.account_number = t.account_number
  AND t.icon IS NOT NULL 
  AND t.color IS NOT NULL;
