/*
  # Remove Redundant Icon and Color from Budgets

  1. Changes
    - Drop icon column from budgets table
    - Drop color column from budgets table
    
  2. Rationale
    - Budgets are linked to chart accounts via chart_account_id
    - Icon and color should come from the linked chart account
    - Storing duplicate data creates maintenance burden
    - Single source of truth = chart account
    
  3. Display Logic
    - Budget icon: Use chartAccount.icon
    - Budget color: Use chartAccount.color
    - Users can customize appearance by editing chart account
    
  4. Impact
    - Simplifies budget schema
    - Ensures consistency across budget and category views
    - No data loss - chart accounts retain all icon/color data
*/

-- Drop icon column from budgets
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'icon'
  ) THEN
    ALTER TABLE budgets DROP COLUMN icon;
  END IF;
END $$;

-- Drop color column from budgets
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'color'
  ) THEN
    ALTER TABLE budgets DROP COLUMN color;
  END IF;
END $$;
