/*
  # Add General Utilities Account and Renumber Internet

  ## Overview
  Adds a new general "Utilities" category at account 6100 and renumbers
  Internet from 6100 to 6110. This provides users with both a catch-all
  utilities category and specific categories for Internet and Phone.

  ## Changes
  1. Renumber Internet from 6100 to 6110
  2. Add new general "Utilities" account at 6100
  3. Update sort_order values:
     - 6100 Utilities: sort_order 53
     - 6110 Internet: sort_order 54
     - 6120 Phone: sort_order 55 (update from 54)

  ## Account Structure After Changes
  - 6100: Utilities (general)
  - 6110: Internet (specific)
  - 6120: Phone (specific)
*/

-- Step 1: Create the new 6110 Internet template first
INSERT INTO chart_of_accounts_templates (
  account_number,
  account_type,
  class,
  account_detail,
  display_name,
  icon,
  color,
  sort_order,
  is_editable
)
SELECT
  6110,
  account_type,
  class,
  account_detail,
  display_name,
  icon,
  color,
  54,
  is_editable
FROM chart_of_accounts_templates
WHERE account_number = 6100
ON CONFLICT (account_number) DO NOTHING;

-- Step 2: Update user accounts from 6100 to 6110
UPDATE user_chart_of_accounts
SET account_number = 6110,
    template_account_number = 6110
WHERE template_account_number = 6100
  AND account_number = 6100;

-- Step 3: Update the old 6100 template to be the new general Utilities
UPDATE chart_of_accounts_templates
SET display_name = 'Utilities',
    icon = 'Zap',
    sort_order = 53
WHERE account_number = 6100;

-- Step 4: Update Phone sort_order from 54 to 55
UPDATE chart_of_accounts_templates
SET sort_order = 55
WHERE account_number = 6120
  AND account_type = 'utilities';

-- Step 5: Provision the new general Utilities account for existing users
INSERT INTO user_chart_of_accounts (
  profile_id,
  template_account_number,
  account_number,
  account_type,
  class,
  account_detail,
  display_name,
  icon,
  color,
  is_active,
  is_user_created,
  current_balance
)
SELECT
  p.id,
  6100,
  6100,
  'utilities',
  'expense',
  'utilities',
  'Utilities',
  'Zap',
  '#EFCE7B',
  true,
  false,
  0.00
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1
  FROM user_chart_of_accounts u
  WHERE u.profile_id = p.id
    AND u.template_account_number = 6100
);