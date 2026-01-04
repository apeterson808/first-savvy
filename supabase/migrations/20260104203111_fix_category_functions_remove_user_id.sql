/*
  # Fix Category Creation Functions - Remove user_id References

  1. Problem
    - Functions `add_user_income_category` and `add_user_expense_category` reference `user_id` column
    - The `user_chart_of_accounts` table only has `profile_id` for ownership
    - This causes "column user_id does not exist" errors

  2. Solution
    - Drop existing functions
    - Recreate functions using only `profile_id` for ownership
    - Maintain all validation logic for account numbers and account details
    - Keep the function signatures and return types the same

  3. Changes
    - Remove all `user_id` column references
    - Use only `profile_id` for ownership checks and inserts
    - Preserve account number generation logic
    - Preserve account detail validation logic
*/

-- Drop existing functions
DROP FUNCTION IF EXISTS add_user_income_category(uuid, text, text, text, text);
DROP FUNCTION IF EXISTS add_user_expense_category(uuid, text, text, text, text);

-- Recreate add_user_income_category function without user_id references
CREATE OR REPLACE FUNCTION add_user_income_category(
  p_profile_id uuid,
  p_name text,
  p_icon text DEFAULT 'DollarSign',
  p_color text DEFAULT '#10b981',
  p_account_detail text DEFAULT 'earned_income'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_number text;
  v_next_number integer;
  v_result jsonb;
BEGIN
  -- Validate account_detail for income
  IF p_account_detail NOT IN ('earned_income', 'passive_income', 'capital_gains', 'other_income') THEN
    RAISE EXCEPTION 'Invalid account_detail for income. Must be one of: earned_income, passive_income, capital_gains, other_income';
  END IF;

  -- Get the next available account number for income (4XXXX range)
  SELECT COALESCE(MAX(CAST(SUBSTRING(account_number FROM 2) AS INTEGER)), 40000) + 1
  INTO v_next_number
  FROM user_chart_of_accounts
  WHERE profile_id = p_profile_id
    AND account_class = 'income'
    AND account_number LIKE '4%';

  -- Ensure we stay within the 4XXXX range
  IF v_next_number > 49999 THEN
    RAISE EXCEPTION 'Maximum number of income accounts (9999) reached';
  END IF;

  v_account_number := v_next_number::text;

  -- Insert the new income category
  INSERT INTO user_chart_of_accounts (
    profile_id,
    account_number,
    account_name,
    account_class,
    account_type,
    account_detail,
    icon,
    color,
    is_active,
    is_system
  )
  VALUES (
    p_profile_id,
    v_account_number,
    p_name,
    'income',
    'revenue',
    p_account_detail,
    p_icon,
    p_color,
    true,
    false
  )
  RETURNING jsonb_build_object(
    'id', id,
    'account_number', account_number,
    'account_name', account_name,
    'account_class', account_class,
    'account_type', account_type,
    'account_detail', account_detail,
    'icon', icon,
    'color', color
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- Recreate add_user_expense_category function without user_id references
CREATE OR REPLACE FUNCTION add_user_expense_category(
  p_profile_id uuid,
  p_name text,
  p_icon text DEFAULT 'ShoppingCart',
  p_color text DEFAULT '#ef4444',
  p_account_detail text DEFAULT 'general_expense'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_number text;
  v_next_number integer;
  v_result jsonb;
BEGIN
  -- Validate account_detail for expense
  IF p_account_detail NOT IN (
    'housing', 'utilities', 'groceries', 'dining', 'transportation', 
    'healthcare', 'insurance', 'shopping', 'entertainment', 'travel',
    'education', 'kids_family', 'pets', 'personal_care', 'gifts_donations',
    'subscriptions', 'professional', 'taxes', 'general_expense'
  ) THEN
    RAISE EXCEPTION 'Invalid account_detail for expense';
  END IF;

  -- Get the next available account number for expense (5XXXX range)
  SELECT COALESCE(MAX(CAST(SUBSTRING(account_number FROM 2) AS INTEGER)), 50000) + 1
  INTO v_next_number
  FROM user_chart_of_accounts
  WHERE profile_id = p_profile_id
    AND account_class = 'expense'
    AND account_number LIKE '5%';

  -- Ensure we stay within the 5XXXX range
  IF v_next_number > 59999 THEN
    RAISE EXCEPTION 'Maximum number of expense accounts (9999) reached';
  END IF;

  v_account_number := v_next_number::text;

  -- Insert the new expense category
  INSERT INTO user_chart_of_accounts (
    profile_id,
    account_number,
    account_name,
    account_class,
    account_type,
    account_detail,
    icon,
    color,
    is_active,
    is_system
  )
  VALUES (
    p_profile_id,
    v_account_number,
    p_name,
    'expense',
    'operating_expense',
    p_account_detail,
    p_icon,
    p_color,
    true,
    false
  )
  RETURNING jsonb_build_object(
    'id', id,
    'account_number', account_number,
    'account_name', account_name,
    'account_class', account_class,
    'account_type', account_type,
    'account_detail', account_detail,
    'icon', icon,
    'color', color
  ) INTO v_result;

  RETURN v_result;
END;
$$;
