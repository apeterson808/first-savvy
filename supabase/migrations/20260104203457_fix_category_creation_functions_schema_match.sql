/*
  # Fix Category Creation Functions to Match Schema

  1. Problem
    - Multiple conflicting versions of add_user_income_category and add_user_expense_category
    - Functions reference non-existent columns: user_id, account_class, account_name, is_system
    - Actual schema has: profile_id, class, display_name, is_user_created

  2. Solution
    - Drop all existing versions
    - Create new versions that match actual schema
    - Use correct parameter names and column mappings

  3. Schema Mapping
    - class (NOT account_class)
    - display_name (NOT account_name)
    - is_user_created (NOT is_system)
    - profile_id (no user_id column)
    - account_number is INTEGER (not text)
*/

-- Drop all existing versions of these functions
DROP FUNCTION IF EXISTS add_user_income_category(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS add_user_income_category(uuid, text, text, integer, text, text);
DROP FUNCTION IF EXISTS add_user_expense_category(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS add_user_expense_category(uuid, text, text, integer, text, text);

-- Create corrected income category function
CREATE OR REPLACE FUNCTION add_user_income_category(
  p_user_id uuid,
  p_category_name text,
  p_account_detail text DEFAULT 'earned_income',
  p_account_number integer DEFAULT NULL,
  p_icon text DEFAULT NULL,
  p_color text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account_number integer;
  v_new_record jsonb;
BEGIN
  -- Validate account_detail is a valid income type
  IF p_account_detail NOT IN ('earned_income', 'passive_income', 'capital_gains', 'other_income') THEN
    RAISE EXCEPTION 'Invalid account_detail for income';
  END IF;

  -- Get account number (use provided or auto-generate)
  IF p_account_number IS NULL THEN
    v_account_number := get_next_available_account_number(p_user_id, 'income');
  ELSE
    v_account_number := p_account_number;
  END IF;

  -- Insert the new category with correct column names
  INSERT INTO user_chart_of_accounts (
    profile_id,
    template_account_number,
    account_number,
    class,
    account_type,
    account_detail,
    display_name,
    icon,
    color,
    is_active,
    is_user_created
  )
  VALUES (
    p_user_id,  -- This is actually profile_id
    NULL,
    v_account_number,
    'income',  -- class column
    p_account_detail,
    p_account_detail,
    p_category_name,  -- display_name column
    p_icon,
    p_color,
    true,
    true  -- is_user_created column
  )
  RETURNING to_jsonb(user_chart_of_accounts.*) INTO v_new_record;

  RETURN v_new_record;
END;
$$;

-- Create corrected expense category function
CREATE OR REPLACE FUNCTION add_user_expense_category(
  p_user_id uuid,
  p_category_name text,
  p_account_detail text DEFAULT 'shopping',
  p_account_number integer DEFAULT NULL,
  p_icon text DEFAULT NULL,
  p_color text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_account_number integer;
  v_new_record jsonb;
BEGIN
  -- Validate account_detail is a valid expense type
  IF p_account_detail NOT IN (
    'housing', 'utilities', 'food_dining', 'transportation', 'insurance',
    'healthcare', 'kids_family', 'education', 'subscriptions', 'shopping',
    'travel', 'lifestyle', 'personal_care', 'professional_services',
    'pets', 'financial', 'giving', 'taxes', 'other_expenses'
  ) THEN
    RAISE EXCEPTION 'Invalid account_detail for expense';
  END IF;

  -- Get account number (use provided or auto-generate)
  IF p_account_number IS NULL THEN
    v_account_number := get_next_available_account_number(p_user_id, 'expense');
  ELSE
    v_account_number := p_account_number;
  END IF;

  -- Insert the new category with correct column names
  INSERT INTO user_chart_of_accounts (
    profile_id,
    template_account_number,
    account_number,
    class,
    account_type,
    account_detail,
    display_name,
    icon,
    color,
    is_active,
    is_user_created
  )
  VALUES (
    p_user_id,  -- This is actually profile_id
    NULL,
    v_account_number,
    'expense',  -- class column
    p_account_detail,
    p_account_detail,
    p_category_name,  -- display_name column
    p_icon,
    p_color,
    true,
    true  -- is_user_created column
  )
  RETURNING to_jsonb(user_chart_of_accounts.*) INTO v_new_record;

  RETURN v_new_record;
END;
$$;
