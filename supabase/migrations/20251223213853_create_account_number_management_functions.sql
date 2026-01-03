/*
  # Create Account Number Management Functions

  ## Overview
  Creates functions to manage account numbers in the unified chart of accounts system:
  1. Get next available account number for user-created accounts
  2. Validate account numbers fall within allowed ranges
  3. Provision chart of accounts for new users
  4. Add user-created income/expense categories
  5. Update account display names

  ## Functions
  - get_next_available_account_number(p_user_id, p_account_type) - Returns next available number
  - validate_account_number_range(p_account_number, p_account_type) - Validates number is in range
  - provision_chart_of_accounts_for_user(p_user_id) - Copies all templates to user
  - add_user_income_category(p_user_id, p_category_name, p_account_number) - Creates income category
  - add_user_expense_category(p_user_id, p_category_name, p_account_number) - Creates expense category
  - update_account_display_name(p_account_id, p_new_display_name) - Updates display name
  - update_account_number(p_account_id, p_new_account_number) - Updates account number
*/

-- Function to get next available account number for user-created accounts
CREATE OR REPLACE FUNCTION get_next_available_account_number(
  p_user_id uuid,
  p_account_type text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_range_start integer;
  v_range_end integer;
  v_next_number integer;
BEGIN
  -- Get the range for this account type
  SELECT number_range_start, number_range_end
  INTO v_range_start, v_range_end
  FROM chart_of_accounts_templates
  WHERE account_type = p_account_type AND level = 1;

  -- If no range is defined, return null
  IF v_range_start IS NULL THEN
    RETURN NULL;
  END IF;

  -- Find the next available number in the range
  SELECT COALESCE(MAX(account_number), v_range_start - 1) + 1
  INTO v_next_number
  FROM user_chart_of_accounts
  WHERE user_id = p_user_id
    AND account_type = p_account_type
    AND account_number >= v_range_start
    AND account_number <= v_range_end;

  -- Check if we've exceeded the range
  IF v_next_number > v_range_end THEN
    RAISE EXCEPTION 'No available account numbers in range % to % for account type %',
      v_range_start, v_range_end, p_account_type;
  END IF;

  RETURN v_next_number;
END;
$$;

-- Function to validate account number is within allowed range
CREATE OR REPLACE FUNCTION validate_account_number_range(
  p_account_number integer,
  p_account_type text,
  p_is_user_created boolean DEFAULT true
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_range_start integer;
  v_range_end integer;
BEGIN
  -- If not user-created, any number is valid (templates control this)
  IF NOT p_is_user_created THEN
    RETURN true;
  END IF;

  -- Get the range for this account type
  SELECT number_range_start, number_range_end
  INTO v_range_start, v_range_end
  FROM chart_of_accounts_templates
  WHERE account_type = p_account_type AND level = 1;

  -- If no range is defined, user cannot create accounts of this type
  IF v_range_start IS NULL THEN
    RETURN false;
  END IF;

  -- Check if number is within range
  RETURN p_account_number >= v_range_start AND p_account_number <= v_range_end;
END;
$$;

-- Function to provision chart of accounts for a new user
CREATE OR REPLACE FUNCTION provision_chart_of_accounts_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Copy all template accounts to user's chart of accounts
  INSERT INTO user_chart_of_accounts (
    user_id,
    template_account_number,
    account_number,
    account_type,
    account_detail,
    category,
    icon,
    color,
    is_active,
    is_user_created,
    level,
    parent_account_number
  )
  SELECT
    p_user_id,
    t.account_number,
    t.account_number,
    t.account_type,
    t.account_detail,
    t.category,
    t.icon,
    t.color,
    true,
    false,
    t.level,
    t.parent_account_number
  FROM chart_of_accounts_templates t
  WHERE NOT EXISTS (
    SELECT 1 FROM user_chart_of_accounts
    WHERE user_id = p_user_id AND template_account_number = t.account_number
  );
END;
$$;

-- Function to add a user-created income category
CREATE OR REPLACE FUNCTION add_user_income_category(
  p_user_id uuid,
  p_category_name text,
  p_account_number integer DEFAULT NULL,
  p_icon text DEFAULT NULL,
  p_color text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_number integer;
  v_new_id uuid;
BEGIN
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
    template_account_number,
    account_number,
    account_type,
    account_detail,
    category,
    icon,
    color,
    is_active,
    is_user_created,
    level,
    parent_account_number,
    custom_display_name
  )
  VALUES (
    p_user_id,
    NULL,
    v_account_number,
    'income',
    'user created',
    p_category_name,
    p_icon,
    p_color,
    true,
    true,
    3,
    4000,
    p_category_name
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- Function to add a user-created expense category
CREATE OR REPLACE FUNCTION add_user_expense_category(
  p_user_id uuid,
  p_category_name text,
  p_account_number integer DEFAULT NULL,
  p_icon text DEFAULT NULL,
  p_color text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_number integer;
  v_new_id uuid;
BEGIN
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
    template_account_number,
    account_number,
    account_type,
    account_detail,
    category,
    icon,
    color,
    is_active,
    is_user_created,
    level,
    parent_account_number,
    custom_display_name
  )
  VALUES (
    p_user_id,
    NULL,
    v_account_number,
    'expense',
    'user created',
    p_category_name,
    p_icon,
    p_color,
    true,
    true,
    3,
    5000,
    p_category_name
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;

-- Function to update account display name (for editable accounts)
CREATE OR REPLACE FUNCTION update_account_display_name(
  p_account_id uuid,
  p_new_display_name text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_template_number integer;
  v_is_editable boolean;
BEGIN
  -- Get the template account number
  SELECT template_account_number INTO v_template_number
  FROM user_chart_of_accounts
  WHERE id = p_account_id AND user_id = auth.uid();

  IF v_template_number IS NULL THEN
    -- User-created account, always editable
    UPDATE user_chart_of_accounts
    SET custom_display_name = p_new_display_name, updated_at = now()
    WHERE id = p_account_id AND user_id = auth.uid();
    RETURN;
  END IF;

  -- Check if the template account is editable
  SELECT is_editable INTO v_is_editable
  FROM chart_of_accounts_templates
  WHERE account_number = v_template_number;

  IF NOT v_is_editable THEN
    RAISE EXCEPTION 'This account display name cannot be edited';
  END IF;

  -- Update the display name
  UPDATE user_chart_of_accounts
  SET custom_display_name = p_new_display_name, updated_at = now()
  WHERE id = p_account_id AND user_id = auth.uid();
END;
$$;

-- Function to update account number (only for user-created accounts)
CREATE OR REPLACE FUNCTION update_account_number(
  p_account_id uuid,
  p_new_account_number integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_user_created boolean;
  v_account_type text;
  v_user_id uuid;
BEGIN
  -- Get account details
  SELECT is_user_created, account_type, user_id
  INTO v_is_user_created, v_account_type, v_user_id
  FROM user_chart_of_accounts
  WHERE id = p_account_id AND user_id = auth.uid();

  -- Only user-created accounts can have their numbers changed
  IF NOT v_is_user_created THEN
    RAISE EXCEPTION 'Only user-created accounts can have their account numbers changed';
  END IF;

  -- Validate the new account number
  IF NOT validate_account_number_range(p_new_account_number, v_account_type, true) THEN
    RAISE EXCEPTION 'Account number % is not in the valid range for % accounts',
      p_new_account_number, v_account_type;
  END IF;

  -- Check if the number is already in use
  IF EXISTS (
    SELECT 1 FROM user_chart_of_accounts
    WHERE user_id = v_user_id
      AND account_number = p_new_account_number
      AND id != p_account_id
  ) THEN
    RAISE EXCEPTION 'Account number % is already in use', p_new_account_number;
  END IF;

  -- Update the account number
  UPDATE user_chart_of_accounts
  SET account_number = p_new_account_number, updated_at = now()
  WHERE id = p_account_id AND user_id = auth.uid();
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_next_available_account_number TO authenticated;
GRANT EXECUTE ON FUNCTION validate_account_number_range TO authenticated;
GRANT EXECUTE ON FUNCTION provision_chart_of_accounts_for_user TO authenticated;
GRANT EXECUTE ON FUNCTION add_user_income_category TO authenticated;
GRANT EXECUTE ON FUNCTION add_user_expense_category TO authenticated;
GRANT EXECUTE ON FUNCTION update_account_display_name TO authenticated;
GRANT EXECUTE ON FUNCTION update_account_number TO authenticated;