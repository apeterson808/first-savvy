/*
  # Create Manual Provisioning Function for Missing User Data

  ## Overview
  Creates a function that can be called from the client to manually provision
  all user data when the automatic provisioning failed during signup.

  ## Function
  - `manual_provision_current_user()` - Provisions complete user setup
    - Creates user_profiles entry
    - Creates default personal profile
    - Creates profile membership
    - Provisions all 81 chart of accounts
    - Creates default profile tab
    - Returns success status with counts

  ## Security
  - SECURITY DEFINER to allow inserting across tables
  - Uses auth.uid() to ensure user can only provision their own data
  - Idempotent - safe to call multiple times
*/

CREATE OR REPLACE FUNCTION manual_provision_current_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_email text;
  v_full_name text;
  v_profile_id uuid;
  v_tab_id uuid;
  v_coa_count int;
  v_user_profile_exists boolean;
  v_profile_exists boolean;
BEGIN
  -- Get current user ID
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Not authenticated'
    );
  END IF;

  -- Get user email and metadata from auth.users
  SELECT email, raw_user_meta_data->>'full_name'
  INTO v_email, v_full_name
  FROM auth.users
  WHERE id = v_user_id;

  -- Check what already exists
  SELECT EXISTS(SELECT 1 FROM user_profiles WHERE id = v_user_id) INTO v_user_profile_exists;
  SELECT EXISTS(SELECT 1 FROM profiles WHERE user_id = v_user_id) INTO v_profile_exists;

  -- Step 1: Ensure user_profiles entry exists
  IF NOT v_user_profile_exists THEN
    INSERT INTO user_profiles (id, email, full_name)
    VALUES (v_user_id, COALESCE(v_email, ''), COALESCE(v_full_name, ''))
    ON CONFLICT (id) DO NOTHING;
  END IF;

  -- Step 2: Ensure default profile exists
  IF NOT v_profile_exists THEN
    INSERT INTO profiles (user_id, profile_type, display_name)
    VALUES (v_user_id, 'personal', 'Personal')
    RETURNING id INTO v_profile_id;

    -- Step 3: Create owner membership
    INSERT INTO profile_memberships (profile_id, user_id, role)
    VALUES (v_profile_id, v_user_id, 'owner');
  ELSE
    -- Get existing profile ID
    SELECT id INTO v_profile_id
    FROM profiles
    WHERE user_id = v_user_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  -- Step 4: Provision chart of accounts (all 81 accounts as inactive)
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
    v_user_id,
    v_profile_id,
    t.account_number,
    t.account_number,
    t.display_name,
    t.class,
    t.account_detail,
    t.account_type,
    t.icon,
    t.color,
    false,  -- Start inactive
    false
  FROM chart_of_accounts_templates t
  WHERE NOT EXISTS (
    SELECT 1 FROM user_chart_of_accounts
    WHERE user_id = v_user_id AND template_account_number = t.account_number
  );

  GET DIAGNOSTICS v_coa_count = ROW_COUNT;

  -- Step 5: Ensure profile tab exists
  SELECT id INTO v_tab_id
  FROM profile_tabs
  WHERE owner_user_id = v_user_id
    AND profile_user_id = v_user_id;

  IF v_tab_id IS NULL THEN
    INSERT INTO profile_tabs (
      owner_user_id,
      profile_user_id,
      profile_type,
      profile_name,
      tab_order,
      is_active,
      last_accessed_at
    )
    VALUES (
      v_user_id,
      v_user_id,
      'personal',
      'Personal',
      0,
      true,
      now()
    )
    RETURNING id INTO v_tab_id;
  END IF;

  -- Return success with details
  RETURN jsonb_build_object(
    'success', true,
    'user_profile_created', NOT v_user_profile_exists,
    'profile_created', NOT v_profile_exists,
    'profile_id', v_profile_id,
    'tab_id', v_tab_id,
    'accounts_provisioned', v_coa_count
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION manual_provision_current_user() TO authenticated;

COMMENT ON FUNCTION manual_provision_current_user() IS
  'Manually provisions complete user setup when automatic provisioning failed. Safe to call multiple times.';
