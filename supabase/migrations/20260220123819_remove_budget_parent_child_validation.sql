/*
  # Remove Budget Parent-Child Validation Constraint

  This migration removes the database-level constraint that prevented child budgets 
  from exceeding their parent budget's allocation.

  ## Changes

  1. Drops the trigger that validates budget allocations
  2. Drops the validation function
  3. Allows users to set child budgets to any amount regardless of parent budget

  ## Rationale
  
  Users should have flexibility to set budgets without strict parent-child constraints.
*/

-- Drop the trigger
DROP TRIGGER IF EXISTS validate_budget_allocation_trigger ON budgets;

-- Drop the validation function
DROP FUNCTION IF EXISTS validate_budget_before_save();
