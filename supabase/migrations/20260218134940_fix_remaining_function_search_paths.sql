/*
  # Fix Remaining Function Search Path Security Issues

  This migration adds the `SET search_path = 'public'` directive to all remaining
  database functions that were flagged with search path mutable warnings.

  ## Functions Updated
  1. `calculate_parent_and_children_spending` (4-param version)
  2. `calculate_total_child_budget_allocations` (2-param version)
  3. `get_parent_budget` (2-param version)
  4. `validate_child_budget_allocation` (4-param version)
  5. `validate_child_budget_allocation` (trigger version - already has it)

  ## Security Enhancement
  - Locks down the schema search path to prevent schema-based attacks
  - Ensures functions only search in the 'public' schema
  - Maintains existing function logic and behavior
*/

-- Fix calculate_parent_and_children_spending (4-param version)
CREATE OR REPLACE FUNCTION public.calculate_parent_and_children_spending(
  p_parent_account_id uuid, 
  p_profile_id uuid, 
  p_start_date date DEFAULT NULL::date, 
  p_end_date date DEFAULT NULL::date
)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
$function$;

-- Fix calculate_total_child_budget_allocations (2-param version)
CREATE OR REPLACE FUNCTION public.calculate_total_child_budget_allocations(
  p_parent_account_id uuid, 
  p_profile_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
$function$;

-- Fix get_parent_budget (2-param version)
CREATE OR REPLACE FUNCTION public.get_parent_budget(
  p_parent_account_id uuid, 
  p_profile_id uuid
)
RETURNS numeric
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
$function$;

-- Fix validate_child_budget_allocation (4-param validation function)
CREATE OR REPLACE FUNCTION public.validate_child_budget_allocation(
  p_child_account_id uuid, 
  p_proposed_amount numeric, 
  p_profile_id uuid, 
  p_budget_id uuid DEFAULT NULL::uuid
)
RETURNS TABLE(
  is_valid boolean, 
  error_message text, 
  parent_budget numeric, 
  allocated_to_children numeric, 
  available_budget numeric
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $function$
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
$function$;
