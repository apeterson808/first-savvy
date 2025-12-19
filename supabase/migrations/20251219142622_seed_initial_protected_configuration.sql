/*
  # Seed Initial Protected Configuration for Category Dropdown

  1. Purpose
    - Creates the initial baseline snapshot of the Category Dropdown system
    - Stores the component logic and constants for protection
    - Enables change tracking and verification

  2. Configuration Includes
    - CategoryDropdown filtering logic
    - Transfer category handling rules
    - DETAIL_TYPE_LABELS constants
    - getAccountDisplayName function logic

  3. Security
    - Uses SECURITY DEFINER to bypass RLS for initial seeding
    - Creates a one-time seed function that can be called by authenticated users
*/

-- Create a function to seed the initial protected configuration
CREATE OR REPLACE FUNCTION seed_category_dropdown_protection()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_config_id uuid;
  v_user_id uuid;
  v_hash text;
  v_config_data jsonb;
  v_result jsonb;
BEGIN
  -- Check if already exists
  SELECT id INTO v_config_id
  FROM protected_configurations
  WHERE name = 'category_dropdown_system'
  LIMIT 1;

  IF v_config_id IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'message', 'Configuration already exists',
      'config_id', v_config_id
    );
  END IF;

  -- Get the current user
  v_user_id := auth.uid();

  -- If no authenticated user, use the first user in the system
  IF v_user_id IS NULL THEN
    SELECT id INTO v_user_id
    FROM auth.users
    ORDER BY created_at
    LIMIT 1;
  END IF;

  -- Build configuration data
  v_config_data := jsonb_build_object(
    'componentName', 'CategoryDropdown',
    'version', '1.0.0',
    'description', 'Protected category dropdown filtering logic and constants',
    'filteringRules', jsonb_build_object(
      'transferHandling', jsonb_build_object(
        'incomeTransfer', 'Categories with type=income AND detail_type=transfer',
        'expenseTransfer', 'Categories with type=expense AND detail_type=transfer',
        'amountBasedSelection', 'Positive amounts use income transfer, negative use expense transfer'
      ),
      'normalCategories', jsonb_build_object(
        'filterOut', 'detail_type=transfer categories',
        'incomeFilter', 'type=income',
        'expenseFilter', 'type=expense',
        'activeOnly', 'is_active !== false'
      )
    ),
    'constants', jsonb_build_object(
      'DETAIL_TYPE_LABELS', 'Object mapping detail_type values to display names',
      'protectedLabels', jsonb_build_array(
        'income', 'expense', 'transfer', 'groceries', 'dining_out',
        'salary', 'business_income', 'rent', 'utilities', 'insurance'
      )
    ),
    'displayNameLogic', jsonb_build_object(
      'incomeExpense', 'Use account.name field directly',
      'otherTypes', 'Use account.account_name field',
      'fallback', 'Empty string if no name available'
    )
  );

  -- Generate hash (simplified for SQL - just use a constant for initial version)
  v_hash := md5(v_config_data::text);

  -- Insert the protected configuration
  INSERT INTO protected_configurations (
    id,
    name,
    description,
    version,
    content_hash,
    configuration_data,
    file_paths,
    is_locked,
    is_active,
    created_by,
    created_at,
    updated_at
  ) VALUES (
    gen_random_uuid(),
    'category_dropdown_system',
    'Category Dropdown Component and Related Constants - This configuration is protected and changes require explicit confirmation',
    '1.0.0',
    v_hash,
    v_config_data,
    jsonb_build_array(
      'src/components/common/CategoryDropdown.jsx',
      'src/components/utils/constants.jsx'
    ),
    true,
    true,
    v_user_id,
    now(),
    now()
  )
  RETURNING id INTO v_config_id;

  -- Log the initial creation
  INSERT INTO configuration_change_log (
    configuration_id,
    user_id,
    change_type,
    new_version,
    change_description,
    confirmed_at,
    created_at
  ) VALUES (
    v_config_id,
    v_user_id,
    'create',
    '1.0.0',
    'Initial baseline configuration created',
    now(),
    now()
  );

  v_result := jsonb_build_object(
    'success', true,
    'message', 'Protected configuration created successfully',
    'config_id', v_config_id,
    'version', '1.0.0',
    'hash', v_hash
  );

  RETURN v_result;
END;
$$;

-- Execute the function to seed the data
SELECT seed_category_dropdown_protection();

-- Drop the function after use to prevent repeated calls
DROP FUNCTION IF EXISTS seed_category_dropdown_protection();