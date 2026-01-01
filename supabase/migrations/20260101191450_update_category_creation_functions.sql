/*
  # Update Category Creation Functions to Accept Account Detail

  ## Overview
  Updates the add_user_income_category and add_user_expense_category functions
  to accept an account_detail parameter, allowing users to specify which type
  of income or expense category they're creating.

  ## Changes
  1. Drops existing functions
  2. Recreates them with p_account_detail parameter
  3. Uses provided account_detail instead of hardcoded 'user created'
  4. Maintains backward compatibility by setting default account_detail values

  ## Security
  - Functions remain SECURITY DEFINER with search_path set
  - Authenticated users can execute these functions
*/

-- Drop existing functions
DROP FUNCTION IF EXISTS add_user_income_category(uuid, text, integer, text, text);
DROP FUNCTION IF EXISTS add_user_expense_category(uuid, text, integer, text, text);

-- Recreate add_user_income_category with account_detail parameter
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
BEGIN
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

-- Recreate add_user_expense_category with account_detail parameter
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
BEGIN
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION add_user_income_category TO authenticated;
GRANT EXECUTE ON FUNCTION add_user_expense_category TO authenticated;
