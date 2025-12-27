/*
  # Sync BASE44 Colors to Existing User Accounts
  
  ## Overview
  Propagates the new BASE44_COLORS from chart_of_accounts_templates to all existing
  user_chart_of_accounts records, ensuring immediate visual consistency across the app.
  
  ## Changes Made
  Updates the color column for all user accounts by matching their account_number with
  the corresponding template's color.
  
  ## Impact
  - All existing users will immediately see BASE44_COLORS in their budget categories
  - Maintains consistency between templates and user data
  - No data loss - only color values are updated
*/

-- Update all user chart of accounts records with colors from templates
UPDATE user_chart_of_accounts uca
SET color = t.color
FROM chart_of_accounts_templates t
WHERE uca.account_number = t.account_number
  AND t.color IS NOT NULL;
