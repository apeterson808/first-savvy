/*
  # Add Missing Budget Columns

  1. New Columns
    - `color` (text) - Visual color for budget items
    - `order` (integer, default 0) - Custom sorting order within groups
    - `parent_budget_id` (uuid) - References budgets table for sub-budget hierarchies
    - `allow_rollover` (boolean, default false) - Allow unused budget to roll to next month
  
  2. Changes
    - Add color column for visual identification
    - Add order column for custom sorting (already in use by app code)
    - Add parent_budget_id for sub-budget support
    - Add allow_rollover for budget rollover feature
    - Add index on parent_budget_id for performance
    - Add foreign key constraint for parent_budget_id
  
  3. Security
    - No RLS changes needed (existing policies cover new columns)
*/

-- Add color column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'color'
  ) THEN
    ALTER TABLE budgets ADD COLUMN color text;
  END IF;
END $$;

-- Add order column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'order'
  ) THEN
    ALTER TABLE budgets ADD COLUMN "order" integer DEFAULT 0;
  END IF;
END $$;

-- Add parent_budget_id column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'parent_budget_id'
  ) THEN
    ALTER TABLE budgets ADD COLUMN parent_budget_id uuid REFERENCES budgets(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add allow_rollover column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'allow_rollover'
  ) THEN
    ALTER TABLE budgets ADD COLUMN allow_rollover boolean DEFAULT false;
  END IF;
END $$;

-- Add index on parent_budget_id if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'budgets' AND indexname = 'idx_budgets_parent_budget_id'
  ) THEN
    CREATE INDEX idx_budgets_parent_budget_id ON budgets(parent_budget_id);
  END IF;
END $$;