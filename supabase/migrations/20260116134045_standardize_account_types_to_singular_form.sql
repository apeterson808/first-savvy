/*
  # Standardize Account Type Naming to Singular Form

  1. Changes
    - Update account_type values in chart_of_accounts_templates from plural to singular
    - Update account_type values in user_chart_of_accounts for existing user data
    - Changes: bank_accounts → bank_account, credit_cards → credit_card, vehicles → vehicle
    - Preserve natural plurals: subscriptions, taxes, utilities (unchanged)

  2. Impact
    - Internal account_type field used for filtering and categorization
    - User-facing display names remain unchanged
    - Creates consistent naming convention: singular form (except natural plurals)

  3. Security
    - No RLS policy changes required
    - Data migration only, no schema changes
*/

-- Update chart_of_accounts_templates table
UPDATE chart_of_accounts_templates
SET account_type = 'bank_account'
WHERE account_type = 'bank_accounts';

UPDATE chart_of_accounts_templates
SET account_type = 'credit_card'
WHERE account_type = 'credit_cards';

UPDATE chart_of_accounts_templates
SET account_type = 'vehicle'
WHERE account_type = 'vehicles';

-- Update user_chart_of_accounts table for existing user data
UPDATE user_chart_of_accounts
SET account_type = 'bank_account'
WHERE account_type = 'bank_accounts';

UPDATE user_chart_of_accounts
SET account_type = 'credit_card'
WHERE account_type = 'credit_cards';

UPDATE user_chart_of_accounts
SET account_type = 'vehicle'
WHERE account_type = 'vehicles';
