/*
  # Add Budget Parent-Child Validation Constraint

  This migration adds a database-level constraint to ensure that child budgets 
  cannot exceed their parent budget's available allocation.

  ## Changes

  1. Creates a validation function that:
     - Checks if a budget category has a parent category
     - Verifies the parent category has a budget
     - Calculates total allocated to all children (including the new/updated one)
     - Ensures children total doesn't exceed parent budget
  
  2. Adds a trigger on budgets table to enforce this constraint on INSERT and UPDATE

  ## Security
  - Uses SECURITY DEFINER with explicit search_path for safety
  - Prevents users from creating invalid budget hierarchies
  - Ensures data integrity at the database level
*/

-- Drop existing trigger and function if they exist
DROP TRIGGER IF EXISTS validate_budget_allocation_trigger ON budgets;
DROP FUNCTION IF EXISTS validate_budget_before_save();

-- Create the validation function
CREATE OR REPLACE FUNCTION validate_budget_before_save()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_parent_account_id UUID;
  v_parent_budget_id UUID;
  v_parent_allocated NUMERIC;
  v_siblings_total NUMERIC;
  v_new_total NUMERIC;
  v_parent_name TEXT;
  v_child_name TEXT;
  v_available NUMERIC;
BEGIN
  -- Get the parent account ID for this budget's chart account
  SELECT parent_account_id INTO v_parent_account_id
  FROM user_chart_of_accounts
  WHERE id = NEW.chart_account_id;

  -- If no parent, allow the operation
  IF v_parent_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if parent account has a budget
  SELECT id, allocated_amount INTO v_parent_budget_id, v_parent_allocated
  FROM budgets
  WHERE chart_account_id = v_parent_account_id
    AND profile_id = NEW.profile_id
    AND is_active = true;

  -- If parent has no budget, block the operation
  IF v_parent_budget_id IS NULL THEN
    SELECT display_name INTO v_parent_name
    FROM user_chart_of_accounts
    WHERE id = v_parent_account_id;
    
    RAISE EXCEPTION 'Cannot create budget for child category. Parent category "%" must have a budget first.', v_parent_name;
  END IF;

  -- Calculate total allocated to all sibling budgets (excluding this one if UPDATE)
  SELECT COALESCE(SUM(b.allocated_amount), 0) INTO v_siblings_total
  FROM budgets b
  JOIN user_chart_of_accounts ca ON b.chart_account_id = ca.id
  WHERE ca.parent_account_id = v_parent_account_id
    AND b.profile_id = NEW.profile_id
    AND b.is_active = true
    AND b.id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);

  -- Add the new/updated budget amount
  v_new_total := v_siblings_total + NEW.allocated_amount;

  -- Check if total exceeds parent budget
  IF v_new_total > v_parent_allocated THEN
    SELECT ca1.display_name, ca2.display_name 
    INTO v_child_name, v_parent_name
    FROM user_chart_of_accounts ca1
    JOIN user_chart_of_accounts ca2 ON ca1.parent_account_id = ca2.id
    WHERE ca1.id = NEW.chart_account_id;
    
    v_available := v_parent_allocated - v_siblings_total;
    
    RAISE EXCEPTION 
      'Budget exceeds parent: "%" requests $%, but parent "%" only has $% available ($% allocated to siblings)',
      v_child_name,
      NEW.allocated_amount,
      v_parent_name,
      v_available,
      v_siblings_total;
  END IF;

  RETURN NEW;
END;
$$;

-- Create the trigger
CREATE TRIGGER validate_budget_allocation_trigger
  BEFORE INSERT OR UPDATE ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION validate_budget_before_save();
