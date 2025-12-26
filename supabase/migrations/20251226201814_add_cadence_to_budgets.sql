/*
  # Add Cadence Column to Budgets Table

  ## Overview
  This migration adds a cadence field to the budgets table to support multiple
  time period representations (daily, weekly, monthly, yearly).

  ## Changes Made

  ### 1. Add cadence column to budgets
  - Type: text with CHECK constraint for valid values
  - Valid values: 'daily', 'weekly', 'monthly', 'yearly'
  - Default: 'monthly' (for backward compatibility)
  - The cadence indicates which time period the allocated_amount represents

  ### 2. Update existing budgets
  - Set cadence to 'monthly' for all existing budget records
  - This ensures backward compatibility with the current system

  ### 3. Performance
  - No index needed on cadence as it's not used for filtering
  - Used primarily for display calculations

  ## Notes
  - The allocated_amount field represents the budget amount for the specified cadence
  - Display logic will convert this to other cadences for UI presentation
  - Only one value is stored (the "source of truth"), all others are computed
*/

-- Step 1: Add cadence column to budgets table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'cadence'
  ) THEN
    ALTER TABLE budgets
      ADD COLUMN cadence text DEFAULT 'monthly' CHECK (cadence IN ('daily', 'weekly', 'monthly', 'yearly'));
    RAISE NOTICE 'Added cadence column to budgets table';
  END IF;
END $$;

-- Step 2: Ensure all existing budgets have cadence set to 'monthly'
UPDATE budgets
SET cadence = 'monthly'
WHERE cadence IS NULL;

-- Step 3: Add helpful comment for developers
COMMENT ON COLUMN budgets.cadence IS 'The time period that allocated_amount represents. Valid values: daily, weekly, monthly, yearly. This is the source of truth; other periods are computed for display.';

-- Log completion
DO $$
BEGIN
  RAISE NOTICE 'Cadence column added to budgets table successfully';
END $$;
