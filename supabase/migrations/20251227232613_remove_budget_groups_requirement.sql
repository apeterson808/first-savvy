/*
  # Remove Budget Groups Requirement

  1. Changes
    - Make budgets.group_id nullable to allow budgets without groups
    - Remove foreign key constraint cascade behavior
    - Set existing budgets with group_id to NULL
    - Add index for budgets without group_id for performance

  2. Notes
    - Keeps budget_groups table intact for backward compatibility
    - Budgets will no longer require a group assignment
    - UI will organize by chart account class instead
*/

DO $$
BEGIN
  -- Drop the existing foreign key constraint if it exists
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'budgets_group_id_fkey' 
    AND table_name = 'budgets'
  ) THEN
    ALTER TABLE budgets DROP CONSTRAINT budgets_group_id_fkey;
    RAISE NOTICE 'Dropped budgets_group_id_fkey constraint';
  END IF;
END $$;

-- Set all existing group_id values to NULL
UPDATE budgets SET group_id = NULL WHERE group_id IS NOT NULL;

-- Ensure group_id column is nullable (it should be by default without NOT NULL constraint)
ALTER TABLE budgets ALTER COLUMN group_id DROP NOT NULL;

-- Add index for queries that filter by null group_id
CREATE INDEX IF NOT EXISTS idx_budgets_null_group ON budgets(id) WHERE group_id IS NULL;