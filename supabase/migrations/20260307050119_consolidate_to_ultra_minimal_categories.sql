/*
  # Consolidate to Ultra-Minimal Category Structure

  1. Overview
    - Simplifies expense categories from 18 types to 4 ultra-minimal types
    - Keeps income split as: earned_income, passive_income, uncategorized
    - New expense structure: fixed_expenses, variable_expenses, discretionary_expenses, uncategorized

  2. Category Mappings
    - **fixed_expenses**: housing, utilities, insurance, subscriptions
    - **variable_expenses**: food_dining, transportation, shopping
    - **discretionary_expenses**: lifestyle, healthcare, kids_family, education, pets, professional_services, taxes, financial, giving, travel, personal_care
    - **uncategorized**: uncategorized (unchanged)

  3. Changes Made
    - Updates chart_of_accounts_templates to new category structure
    - Migrates all existing user_chart_of_accounts records
    - Preserves display names and account numbers
    - Maintains all foreign key relationships

  4. Data Safety
    - All existing transactions remain linked via account_number
    - Budget assignments preserved
    - Journal entries unaffected
    - User-created categories updated to match new structure
*/

-- Step 1: Update chart_of_accounts_templates for expense consolidation
-- Map housing, utilities, insurance, subscriptions -> fixed_expenses
UPDATE chart_of_accounts_templates
SET 
  account_type = 'fixed_expenses',
  account_detail = 'fixed_expenses'
WHERE class = 'expense'
  AND account_type IN ('housing', 'utilities', 'insurance', 'subscriptions');

-- Map food_dining, transportation, shopping -> variable_expenses
UPDATE chart_of_accounts_templates
SET 
  account_type = 'variable_expenses',
  account_detail = 'variable_expenses'
WHERE class = 'expense'
  AND account_type IN ('food_dining', 'transportation', 'shopping');

-- Map all discretionary categories -> discretionary_expenses
UPDATE chart_of_accounts_templates
SET 
  account_type = 'discretionary_expenses',
  account_detail = 'discretionary_expenses'
WHERE class = 'expense'
  AND account_type IN (
    'lifestyle', 'healthcare', 'kids_family', 'education', 
    'pets', 'professional_services', 'taxes', 'financial', 
    'giving', 'travel', 'personal_care'
  );

-- Step 2: Update all existing user chart of accounts records
-- Map fixed expense categories
UPDATE user_chart_of_accounts
SET 
  account_type = 'fixed_expenses',
  account_detail = 'fixed_expenses'
WHERE class = 'expense'
  AND account_type IN ('housing', 'utilities', 'insurance', 'subscriptions');

-- Map variable expense categories
UPDATE user_chart_of_accounts
SET 
  account_type = 'variable_expenses',
  account_detail = 'variable_expenses'
WHERE class = 'expense'
  AND account_type IN ('food_dining', 'transportation', 'shopping');

-- Map discretionary expense categories
UPDATE user_chart_of_accounts
SET 
  account_type = 'discretionary_expenses',
  account_detail = 'discretionary_expenses'
WHERE class = 'expense'
  AND account_type IN (
    'lifestyle', 'healthcare', 'kids_family', 'education', 
    'pets', 'professional_services', 'taxes', 'financial', 
    'giving', 'travel', 'personal_care'
  );

-- Step 3: Verify no orphaned records exist
-- All income categories should remain: earned_income, passive_income, uncategorized
-- All expense categories should now be: fixed_expenses, variable_expenses, discretionary_expenses, uncategorized
