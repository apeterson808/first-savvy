/*
  # Update User Provisioning to Include Chart of Accounts

  ## Overview
  Updates the manual_provision_current_user() function to automatically create
  the default chart of accounts from templates when provisioning a new user profile.

  ## Changes
  - Adds chart of accounts creation step to manual_provision_current_user()
  - Copies all templates from chart_of_accounts_templates to user_chart_of_accounts
  - Sets all accounts to inactive by default (user activates as needed)

  ## Benefits
  - New users immediately have access to all account categories
  - Child profiles created via edge function have proper chart of accounts
  - Ensures consistency across all user profiles
*/

-- Update the manual_provision_current_user function to include chart of accounts
CREATE OR REPLACE FUNCTION manual_provision_current_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
  v_display_name text;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Check if user already has a profile
  SELECT p.id INTO v_profile_id
  FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = v_user_id
  LIMIT 1;

  IF v_profile_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Profile already exists', 'profile_id', v_profile_id);
  END IF;

  -- Get user email for display name
  SELECT COALESCE(raw_user_meta_data->>'full_name', email)
  INTO v_display_name
  FROM auth.users
  WHERE id = v_user_id;

  -- Create profile
  INSERT INTO profiles (user_id, profile_type, display_name, is_deleted)
  VALUES (v_user_id, 'personal', COALESCE(v_display_name, 'My Profile'), false)
  RETURNING id INTO v_profile_id;

  -- Create profile membership
  INSERT INTO profile_memberships (user_id, profile_id, role)
  VALUES (v_user_id, v_profile_id, 'owner');

  -- Create profile tab
  INSERT INTO profile_tabs (owner_user_id, profile_id, display_name, is_active)
  VALUES (v_user_id, v_profile_id, COALESCE(v_display_name, 'My Profile'), true);

  -- Create chart of accounts from templates
  INSERT INTO user_chart_of_accounts (
    profile_id,
    account_number,
    template_account_number,
    account_type,
    account_detail,
    display_name,
    class,
    current_balance,
    is_active,
    is_user_created,
    icon,
    color,
    parent_account_id
  )
  SELECT
    v_profile_id,
    account_number,
    account_number,
    account_type,
    account_detail,
    display_name,
    class,
    0,
    false,
    false,
    icon,
    color,
    NULL
  FROM chart_of_accounts_templates
  ORDER BY account_number;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Profile created successfully with chart of accounts',
    'profile_id', v_profile_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;