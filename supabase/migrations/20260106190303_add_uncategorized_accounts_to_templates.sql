/*
  # Add Uncategorized Accounts to Chart of Accounts Templates

  ## Overview
  Adds "Uncategorized Income" and "Uncategorized Expense" accounts to the chart of accounts
  templates. These accounts serve as defaults when transactions are posted without a category,
  ensuring journal entries can always be created and account balances remain accurate.

  ## New Accounts
  - 4999: Uncategorized Income (at end of Income range)
  - 9999: Uncategorized Expense (at end of Expense range)

  ## Rationale
  - Separates accounting (posting) from budgeting (categorizing)
  - Account balances match bank statements immediately
  - Users can categorize transactions at their own pace
  - Follows industry-standard practices (QuickBooks, Xero, etc.)

  ## Security
  - No RLS changes needed (uses existing user_chart_of_accounts policies)
*/

-- Add Uncategorized Income account template
INSERT INTO chart_of_accounts_templates (
  account_number,
  class,
  account_type,
  account_detail,
  display_name,
  icon,
  color,
  is_editable,
  sort_order
) VALUES
(4999, 'income', 'uncategorized', 'uncategorized', 'Uncategorized Income', 'HelpCircle', '#9ca3af', false, 999)
ON CONFLICT (account_number) DO NOTHING;

-- Add Uncategorized Expense account template
INSERT INTO chart_of_accounts_templates (
  account_number,
  class,
  account_type,
  account_detail,
  display_name,
  icon,
  color,
  is_editable,
  sort_order
) VALUES
(9999, 'expense', 'uncategorized', 'uncategorized', 'Uncategorized Expense', 'HelpCircle', '#9ca3af', false, 999)
ON CONFLICT (account_number) DO NOTHING;
