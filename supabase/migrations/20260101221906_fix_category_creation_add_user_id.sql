/*
  # Fix Category Creation Functions - Add user_id

  ## Overview
  The add_user_expense_category and add_user_income_category functions were not
  setting the user_id column when inserting into user_chart_of_accounts, causing
  a NOT NULL constraint violation.

  ## Changes
  1. Updates both functions to set user_id = profile_id (since p_user_id is actually a profile_id)
  2. Maintains all existing functionality

  ## Fix
  - Adds user_id to the INSERT statement in both functions
*/

-- Fix add_user_income_category to include user_id
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
SET search_path = public
AS $$
DECLARE
  v_account_number integer;
  v_new_record jsonb;
  v_user_id uuid;
BEGIN
  -- Get the actual user_id from the profile
  SELECT user_id INTO v_user_id
  FROM profiles
  WHERE id = p_user_id;

  -- Validate account_detail is a valid income type
  IF p_account_detail NOT IN ('earned_income', 'passive_income') THEN
    RAISE EXCEPTION 'Invalid account_detail for income. Must be earned_income or passive_income';
  END IF;

  -- Get account number (use provided or auto-generate)
  IF p_account_number IS NULL THEN
    v_account_number := get_next_available_account_number(p_user_id, 'income');
  ELSE
    -- Validate the provided number
    IF NOT validate_account_number_range(p_account_number, 'income', true) THEN
      RAISE EXCEPTION 'Account number % is not in the valid range for income accounts', p_account_number;
    END IF;
    v_account_number := p_account_number;
  END IF;

  -- Insert the new category
  INSERT INTO user_chart_of_accounts (
    user_id,
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
    v_user_id,
    p_user_id,
    NULL,
    v_account_number,
    'income',
    p_account_detail,
    p_account_detail,
    p_category_name,
    p_icon,
    p_color,
    true,
    true
  )
  RETURNING to_jsonb(user_chart_of_accounts.*) INTO v_new_record;

  RETURN v_new_record;
END;
$$;

-- Fix add_user_expense_category to include user_id
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
SET search_path = public
AS $$
DECLARE
  v_account_number integer;
  v_new_record jsonb;
  v_user_id uuid;
BEGIN
  -- Get the actual user_id from the profile
  SELECT user_id INTO v_user_id
  FROM profiles
  WHERE id = p_user_id;

  -- Validate account_detail is a valid expense type
  IF p_account_detail NOT IN (
    'housing', 'utilities', 'food_dining', 'transportation', 'insurance',
    'healthcare', 'kids_family', 'education', 'subscriptions', 'shopping',
    'travel', 'lifestyle', 'personal_care', 'professional_services',
    'pets', 'financial', 'giving', 'taxes'
  ) THEN
    RAISE EXCEPTION 'Invalid account_detail for expense. See chart of accounts for valid values';
  END IF;

  -- Get account number (use provided or auto-generate)
  IF p_account_number IS NULL THEN
    v_account_number := get_next_available_account_number(p_user_id, 'expense');
  ELSE
    -- Validate the provided number
    IF NOT validate_account_number_range(p_account_number, 'expense', true) THEN
      RAISE EXCEPTION 'Account number % is not in the valid range for expense accounts', p_account_number;
    END IF;
    v_account_number := p_account_number;
  END IF;

  -- Insert the new category
  INSERT INTO user_chart_of_accounts (
    user_id,
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
    v_user_id,
    p_user_id,
    NULL,
    v_account_number,
    'expense',
    p_account_detail,
    p_account_detail,
    p_category_name,
    p_icon,
    p_color,
    true,
    true
  )
  RETURNING to_jsonb(user_chart_of_accounts.*) INTO v_new_record;

  RETURN v_new_record;
END;
$$;

GRANT EXECUTE ON FUNCTION add_user_income_category TO authenticated;
GRANT EXECUTE ON FUNCTION add_user_expense_category TO authenticated;
