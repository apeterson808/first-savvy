/*
  # Remove Budgets Period Field

  1. Changes
    - Drop period column from budgets table
    
  2. Rationale
    - Duplicate of cadence field (added in migration 20251226201814)
    - period had only monthly/yearly values
    - cadence supports daily/weekly/monthly/yearly (more flexible)
    - cadence is the source of truth used throughout application
    
  3. Migration Strategy
    - All code already uses cadence field
    - Safe to drop period without data migration
    
  4. Impact
    - Simplifies schema
    - Removes confusion between two similar fields
    - No functional changes - cadence remains
*/

-- Drop period column from budgets
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'period'
  ) THEN
    ALTER TABLE budgets DROP COLUMN period;
  END IF;
END $$;
