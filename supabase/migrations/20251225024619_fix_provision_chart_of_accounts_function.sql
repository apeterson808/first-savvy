/*
  # Fix Chart of Accounts Provisioning Function

  ## Changes
  Updates the provision_chart_of_accounts_for_user function to match the current
  schema structure after the flat COA refactoring:
  
  - Removes references to obsolete columns (category, level, parent_account_number)
  - Uses correct column names (class instead of category, display_name)
  - Matches the current chart_of_accounts_templates and user_chart_of_accounts schemas
  
  ## Schema Alignment
  Templates have: account_number, class, account_detail, account_type, display_name, icon, color
  User COA has: user_id, template_account_number, account_number, display_name, class, account_detail, account_type
*/

-- Drop and recreate the provision function with correct schema
CREATE OR REPLACE FUNCTION provision_chart_of_accounts_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  -- Get the user's default profile
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_user_id
  ORDER BY created_at ASC
  LIMIT 1;

  -- Copy all template accounts to user's chart of accounts
  INSERT INTO user_chart_of_accounts (
    user_id,
    profile_id,
    template_account_number,
    account_number,
    display_name,
    class,
    account_detail,
    account_type,
    icon,
    color,
    is_active,
    is_user_created
  )
  SELECT
    p_user_id,
    v_profile_id,
    t.account_number,
    t.account_number,
    t.display_name,
    t.class,
    t.account_detail,
    t.account_type,
    t.icon,
    t.color,
    true,
    false
  FROM chart_of_accounts_templates t
  WHERE NOT EXISTS (
    SELECT 1 FROM user_chart_of_accounts
    WHERE user_id = p_user_id AND template_account_number = t.account_number
  );
END;
$$;
