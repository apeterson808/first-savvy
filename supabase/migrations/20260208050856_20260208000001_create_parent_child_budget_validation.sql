/*
  # Parent-Child Budget Validation System

  ## Overview
  This migration implements flexible parent-child budget constraints where:
  - Child budgets represent planned allocations from the parent budget
  - Spending enforcement happens at the parent level only
  - Child categories can exceed their allocated amounts without restrictions
  - Child budgets cannot exceed the parent budget total when combined

  ## Changes Made

  ### 1. Database Functions
  - `calculate_total_child_budget_allocations(parent_id UUID)` - Calculates sum of child budget allocations
  - `calculate_parent_and_children_spending(parent_account_id UUID, profile_id UUID)` - Calculates total spending
  - `get_parent_budget(parent_account_id UUID, profile_id UUID)` - Gets parent budget amount
  - `validate_child_budget_allocation(child_account_id UUID, proposed_amount NUMERIC, profile_id UUID)` - Validates child budget fits within parent

  ### 2. Database Triggers
  - Trigger to prevent creating child budget when parent has no budget
  - Trigger to validate child allocation doesn't exceed available parent budget space

  ### 3. Performance
  - Uses existing index on parent_account_id for efficient queries

  ## Security
  - All functions use profile_id for multi-tenancy
  - No RLS changes needed (functions are called within user context)

  ## Notes
  - Child allocations are planning amounts, not spending limits
  - Only parent budget enforces actual spending constraints
  - Example: Utilities $500 parent, Water $100 child can spend $200 if total spending stays under $500
*/

-- =====================================================
-- Function: Calculate Total Child Budget Allocations
-- =====================================================
-- Returns the sum of all child budget allocated_amounts for a given parent category

CREATE OR REPLACE FUNCTION calculate_total_child_budget_allocations(
  p_parent_account_id UUID,
  p_profile_id UUID
)
RETURNS NUMERIC AS $$
DECLARE
  v_total NUMERIC;
BEGIN
  -- Get all child category IDs
  WITH child_categories AS (
    SELECT id
    FROM user_chart_of_accounts
    WHERE parent_account_id = p_parent_account_id
      AND profile_id = p_profile_id
      AND is_active = true
  )
  -- Sum their budget allocations
  SELECT COALESCE(SUM(b.allocated_amount), 0)
  INTO v_total
  FROM budgets b
  WHERE b.chart_account_id IN (SELECT id FROM child_categories)
    AND b.profile_id = p_profile_id
    AND b.is_active = true;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================
-- Function: Calculate Parent and Children Total Spending
-- =====================================================
-- Returns the combined spending across parent category and all its children

CREATE OR REPLACE FUNCTION calculate_parent_and_children_spending(
  p_parent_account_id UUID,
  p_profile_id UUID,
  p_start_date DATE DEFAULT NULL,
  p_end_date DATE DEFAULT NULL
)
RETURNS NUMERIC AS $$
DECLARE
  v_total NUMERIC;
  v_start_date DATE;
  v_end_date DATE;
BEGIN
  -- Default to current month if dates not provided
  v_start_date := COALESCE(p_start_date, DATE_TRUNC('month', CURRENT_DATE)::DATE);
  v_end_date := COALESCE(p_end_date, (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE);

  -- Get all child category IDs plus the parent
  WITH all_categories AS (
    SELECT id
    FROM user_chart_of_accounts
    WHERE (id = p_parent_account_id OR parent_account_id = p_parent_account_id)
      AND profile_id = p_profile_id
      AND is_active = true
  )
  -- Sum spending across all transactions
  SELECT COALESCE(SUM(t.amount), 0)
  INTO v_total
  FROM transactions t
  WHERE t.category_account_id IN (SELECT id FROM all_categories)
    AND t.profile_id = p_profile_id
    AND t.status = 'posted'
    AND t.type = 'expense'
    AND t.date >= v_start_date
    AND t.date <= v_end_date;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================
-- Function: Get Parent Budget Amount
-- =====================================================
-- Returns the budget amount for a parent category

CREATE OR REPLACE FUNCTION get_parent_budget(
  p_parent_account_id UUID,
  p_profile_id UUID
)
RETURNS NUMERIC AS $$
DECLARE
  v_amount NUMERIC;
BEGIN
  SELECT allocated_amount
  INTO v_amount
  FROM budgets
  WHERE chart_account_id = p_parent_account_id
    AND profile_id = p_profile_id
    AND is_active = true
  LIMIT 1;

  RETURN COALESCE(v_amount, 0);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================
-- Function: Validate Child Budget Allocation
-- =====================================================
-- Validates that a child budget allocation doesn't exceed available parent budget space

CREATE OR REPLACE FUNCTION validate_child_budget_allocation(
  p_child_account_id UUID,
  p_proposed_amount NUMERIC,
  p_profile_id UUID,
  p_budget_id UUID DEFAULT NULL
)
RETURNS TABLE(
  is_valid BOOLEAN,
  error_message TEXT,
  parent_budget NUMERIC,
  allocated_to_children NUMERIC,
  available_budget NUMERIC
) AS $$
DECLARE
  v_parent_account_id UUID;
  v_parent_budget NUMERIC;
  v_allocated_to_children NUMERIC;
  v_current_child_allocation NUMERIC := 0;
  v_available_budget NUMERIC;
  v_parent_name TEXT;
BEGIN
  -- Get the parent account ID for this child
  SELECT parent_account_id
  INTO v_parent_account_id
  FROM user_chart_of_accounts
  WHERE id = p_child_account_id
    AND profile_id = p_profile_id;

  -- If no parent, this is a parent category - always valid
  IF v_parent_account_id IS NULL THEN
    RETURN QUERY SELECT true, NULL::TEXT, NULL::NUMERIC, NULL::NUMERIC, NULL::NUMERIC;
    RETURN;
  END IF;

  -- Get parent budget amount
  v_parent_budget := get_parent_budget(v_parent_account_id, p_profile_id);

  -- If parent has no budget, child budget cannot be created
  IF v_parent_budget = 0 THEN
    SELECT display_name INTO v_parent_name
    FROM user_chart_of_accounts
    WHERE id = v_parent_account_id;

    RETURN QUERY SELECT
      false,
      format('Cannot create budget for child category. Parent category "%s" has no budget. Please create a budget for the parent first.', v_parent_name),
      0::NUMERIC,
      0::NUMERIC,
      0::NUMERIC;
    RETURN;
  END IF;

  -- Get total allocated to children (excluding the current budget if editing)
  v_allocated_to_children := calculate_total_child_budget_allocations(v_parent_account_id, p_profile_id);

  -- If editing, subtract the current allocation
  IF p_budget_id IS NOT NULL THEN
    SELECT allocated_amount INTO v_current_child_allocation
    FROM budgets
    WHERE id = p_budget_id AND profile_id = p_profile_id;
    v_allocated_to_children := v_allocated_to_children - COALESCE(v_current_child_allocation, 0);
  END IF;

  -- Calculate available budget
  v_available_budget := v_parent_budget - v_allocated_to_children;

  -- Check if proposed amount exceeds available budget
  IF p_proposed_amount > v_available_budget THEN
    SELECT display_name INTO v_parent_name
    FROM user_chart_of_accounts
    WHERE id = v_parent_account_id;

    RETURN QUERY SELECT
      false,
      format('Child budget allocation ($%s) exceeds available parent budget ($%s). Parent "%s" has $%s total budget with $%s already allocated to other children.',
        p_proposed_amount, v_available_budget, v_parent_name, v_parent_budget, v_allocated_to_children),
      v_parent_budget,
      v_allocated_to_children,
      v_available_budget;
    RETURN;
  END IF;

  -- Validation passed
  RETURN QUERY SELECT true, NULL::TEXT, v_parent_budget, v_allocated_to_children, v_available_budget;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- =====================================================
-- Trigger: Validate Budget Before Insert or Update
-- =====================================================

CREATE OR REPLACE FUNCTION validate_budget_before_save()
RETURNS TRIGGER AS $$
DECLARE
  v_validation RECORD;
BEGIN
  -- Run validation
  SELECT * INTO v_validation
  FROM validate_child_budget_allocation(
    NEW.chart_account_id,
    NEW.allocated_amount,
    NEW.profile_id,
    NEW.id
  );

  -- If validation failed, raise exception
  IF NOT v_validation.is_valid THEN
    RAISE EXCEPTION '%', v_validation.error_message;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS validate_budget_allocation_trigger ON budgets;

-- Create trigger for INSERT and UPDATE
CREATE TRIGGER validate_budget_allocation_trigger
  BEFORE INSERT OR UPDATE OF allocated_amount, chart_account_id
  ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION validate_budget_before_save();

-- =====================================================
-- Add helpful comments
-- =====================================================

COMMENT ON FUNCTION calculate_total_child_budget_allocations IS 'Calculates the sum of all child budget allocations for a given parent category';
COMMENT ON FUNCTION calculate_parent_and_children_spending IS 'Calculates total spending across parent category and all its children for a time period';
COMMENT ON FUNCTION get_parent_budget IS 'Returns the budget amount for a parent category';
COMMENT ON FUNCTION validate_child_budget_allocation IS 'Validates that a child budget allocation does not exceed available parent budget space';