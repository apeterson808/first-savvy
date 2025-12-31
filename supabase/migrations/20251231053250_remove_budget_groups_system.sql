/*
  # Remove Budget Groups System

  1. Changes
    - Drop group_id foreign key constraint from budgets table
    - Drop group_id column from budgets table
    - Drop budget_groups table entirely
    
  2. Rationale
    - Budget groups were made optional in migration 20251227232613
    - Chart of accounts already provides natural grouping via account_type
    - Simplifies architecture and removes redundant system
    - Budgets link directly to chart accounts for categorization
    
  3. Impact
    - Budgets now managed solely by chart_account_id
    - UI will group budgets by chart account's account_type if needed
    - No data loss - budget allocations preserved
    
  4. Alternative Grouping Strategy
    - Use chart_of_accounts.account_type for grouping (housing, food_dining, etc.)
    - Use chart_of_accounts.class for income vs expense separation
    - Custom grouping can be added to UI layer without database complexity
*/

-- Drop foreign key constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'budgets_group_id_fkey'
    AND table_name = 'budgets'
  ) THEN
    ALTER TABLE budgets DROP CONSTRAINT budgets_group_id_fkey;
  END IF;
END $$;

-- Drop group_id column from budgets
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'group_id'
  ) THEN
    ALTER TABLE budgets DROP COLUMN group_id;
  END IF;
END $$;

-- Drop budget_groups table
DROP TABLE IF EXISTS budget_groups CASCADE;
