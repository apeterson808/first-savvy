/*
  # Add Budget Rollover Support
  
  1. Changes
    - Add `rollover_enabled` column to budgets table
    - Add `accumulated_rollover` column to track rolled-over unused budget
    - Add index for performance on rollover queries
  
  2. Purpose
    - Support accumulating unused budget for periodic expenses
    - Example: Property taxes paid twice yearly can budget monthly but accumulate
*/

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'budgets' AND column_name = 'rollover_enabled'
  ) THEN
    ALTER TABLE budgets ADD COLUMN rollover_enabled boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'budgets' AND column_name = 'accumulated_rollover'
  ) THEN
    ALTER TABLE budgets ADD COLUMN accumulated_rollover numeric(12,2) DEFAULT 0;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_budgets_rollover_enabled ON budgets(rollover_enabled) WHERE rollover_enabled = true;
