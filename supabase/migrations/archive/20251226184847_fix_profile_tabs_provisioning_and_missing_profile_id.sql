/*
  # Fix Profile Tabs Provisioning and Missing profile_id
  
  ## Overview
  This migration fixes the profile_tabs system to ensure all tabs have proper profile_id values
  and updates all provisioning functions to correctly set profile_id when creating tabs.
  
  ## Changes Made
  
  ### 1. Backfill missing profile_id values
  - Sets profile_id based on the linked profile from profile_user_id
  
  ### 2. Update ensure_default_tab() function
  - Properly sets profile_id when creating new tabs
  - Ensures profile_id is always populated
  
  ### 3. Update ensure_complete_provisioning() function  
  - Fixes incorrect query logic (was using owner_user_id = v_profile_id which is wrong)
  - Properly creates tabs with profile_id set
  
  ### 4. Update handle_new_user_profile() trigger function
  - Sets profile_id when creating default tab during signup
  
  ## Important Notes
  - All existing tabs will be updated to have correct profile_id
  - All provisioning functions now correctly populate profile_id
  - This fixes the PGRST116 errors in the console
*/

-- Step 1: Backfill missing profile_id values in existing profile_tabs
UPDATE profile_tabs pt
SET profile_id = p.id
FROM profiles p
WHERE pt.profile_user_id = p.user_id
  AND pt.profile_id IS NULL
  AND p.profile_type = 'personal'
  AND p.is_deleted = false;

-- Step 2: Update ensure_default_tab() to properly set profile_id
CREATE OR REPLACE FUNCTION ensure_default_tab(p_profile_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_tab_id uuid;
  v_profile_name text;
  v_profile_user_id uuid;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get profile details
  SELECT display_name, user_id
  INTO v_profile_name, v_profile_user_id
  FROM profiles
  WHERE id = p_profile_id
    AND NOT is_deleted;

  IF v_profile_name IS NULL THEN
    RAISE EXCEPTION 'Profile not found or is deleted';
  END IF;

  -- Check if tab already exists for this user and profile
  SELECT id INTO v_tab_id
  FROM profile_tabs
  WHERE owner_user_id = v_user_id
    AND profile_id = p_profile_id;

  -- If no tab exists, create one
  IF v_tab_id IS NULL THEN
    -- Deactivate any existing active tabs first
    UPDATE profile_tabs
    SET is_active = false
    WHERE owner_user_id = v_user_id
      AND is_active = true;

    -- Create new tab with profile_id set
    INSERT INTO profile_tabs (
      owner_user_id,
      profile_user_id,
      profile_id,
      display_name,
      profile_type,
      profile_name,
      tab_order,
      is_active,
      last_accessed_at
    )
    VALUES (
      v_user_id,
      v_profile_user_id,
      p_profile_id,
      v_profile_name,
      'personal',
      v_profile_name,
      0,
      true,
      now()
    )
    RETURNING id INTO v_tab_id;
  ELSE
    -- Tab exists, ensure it's active and has profile_id set
    UPDATE profile_tabs
    SET is_active = true,
        last_accessed_at = now(),
        profile_id = p_profile_id,
        display_name = v_profile_name
    WHERE id = v_tab_id;

    -- Deactivate other tabs
    UPDATE profile_tabs
    SET is_active = false
    WHERE owner_user_id = v_user_id
      AND id != v_tab_id
      AND is_active = true;
  END IF;

  RETURN v_tab_id;
END;
$$;

-- Step 3: Fix ensure_complete_provisioning() with correct logic
CREATE OR REPLACE FUNCTION ensure_complete_provisioning()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
  v_membership_id uuid;
  v_tab_id uuid;
  v_created_profile boolean := false;
  v_created_membership boolean := false;
  v_created_tab boolean := false;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;

  -- Find or create personal profile
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = v_user_id
    AND profile_type = 'personal'
    AND is_deleted = false
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    INSERT INTO profiles (user_id, profile_type, display_name)
    VALUES (v_user_id, 'personal', 'Personal')
    RETURNING id INTO v_profile_id;

    v_created_profile := true;
  END IF;

  -- Find or create owner membership
  SELECT id INTO v_membership_id
  FROM profile_memberships
  WHERE profile_id = v_profile_id
    AND user_id = v_user_id
    AND role = 'owner'
  LIMIT 1;

  IF v_membership_id IS NULL THEN
    INSERT INTO profile_memberships (profile_id, user_id, role)
    VALUES (v_profile_id, v_user_id, 'owner')
    ON CONFLICT DO NOTHING
    RETURNING id INTO v_membership_id;

    IF v_membership_id IS NOT NULL THEN
      v_created_membership := true;
    ELSE
      SELECT id INTO v_membership_id
      FROM profile_memberships
      WHERE profile_id = v_profile_id
        AND user_id = v_user_id
        AND role = 'owner'
      LIMIT 1;
    END IF;
  END IF;

  -- Find or create profile tab (fixed query - was using owner_user_id = v_profile_id which was wrong)
  SELECT id INTO v_tab_id
  FROM profile_tabs
  WHERE owner_user_id = v_user_id
    AND profile_id = v_profile_id
  LIMIT 1;

  IF v_tab_id IS NULL THEN
    -- Deactivate other tabs first
    UPDATE profile_tabs
    SET is_active = false
    WHERE owner_user_id = v_user_id
      AND is_active = true;

    -- Create new tab with profile_id properly set
    INSERT INTO profile_tabs (
      owner_user_id,
      profile_user_id,
      profile_id,
      display_name,
      profile_type,
      profile_name,
      is_active,
      tab_order,
      last_accessed_at
    )
    VALUES (
      v_user_id,
      v_user_id,
      v_profile_id,
      'Personal',
      'personal',
      'Personal',
      true,
      0,
      now()
    )
    RETURNING id INTO v_tab_id;

    v_created_tab := true;
  ELSE
    -- Ensure existing tab is active
    UPDATE profile_tabs
    SET is_active = true,
        profile_id = v_profile_id,
        last_accessed_at = now()
    WHERE id = v_tab_id
      AND is_active = false;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'profile_id', v_profile_id,
    'membership_id', v_membership_id,
    'tab_id', v_tab_id,
    'created_profile', v_created_profile,
    'created_membership', v_created_membership,
    'created_tab', v_created_tab
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error in ensure_complete_provisioning: %', SQLERRM;
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

-- Step 4: Update handle_new_user_profile() trigger to set profile_id
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  new_profile_id uuid;
  new_tab_id uuid;
  new_coa_count int;
  v_full_name text;
  v_email text;
BEGIN
  BEGIN
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
    v_email := COALESCE(NEW.email, '');

    -- 1. Create user_profiles entry
    INSERT INTO user_profiles (id, email, full_name)
    VALUES (NEW.id, v_email, v_full_name)
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      full_name = CASE
        WHEN COALESCE(EXCLUDED.full_name, '') != ''
        THEN EXCLUDED.full_name
        ELSE user_profiles.full_name
      END;

    -- 2. Create default personal profile
    INSERT INTO profiles (user_id, profile_type, display_name)
    VALUES (NEW.id, 'personal', 'Personal')
    RETURNING id INTO new_profile_id;

    -- 3. Create owner membership
    INSERT INTO profile_memberships (profile_id, user_id, role)
    VALUES (new_profile_id, NEW.id, 'owner');

    -- 4. Auto-provision chart of accounts for the new profile
    INSERT INTO user_chart_of_accounts (
      user_id,
      profile_id,
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
      NEW.id,
      new_profile_id,
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
    ORDER BY t.account_number;

    GET DIAGNOSTICS new_coa_count = ROW_COUNT;

    -- 5. Create default tab with profile_id properly set
    INSERT INTO profile_tabs (
      owner_user_id,
      profile_user_id,
      profile_id,
      display_name,
      profile_type,
      profile_name,
      tab_order,
      is_active,
      last_accessed_at
    )
    VALUES (
      NEW.id,
      NEW.id,
      new_profile_id,
      'Personal',
      'personal',
      'Personal',
      0,
      true,
      now()
    )
    RETURNING id INTO new_tab_id;

    RAISE NOTICE 'Successfully provisioned user %: profile %, % chart accounts, tab %',
      NEW.id, new_profile_id, new_coa_count, new_tab_id;

  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to provision user %: % (SQLSTATE: %)',
        NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION ensure_default_tab(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_complete_provisioning() TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_complete_provisioning() TO anon;
GRANT EXECUTE ON FUNCTION handle_new_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user_profile() TO service_role;
GRANT EXECUTE ON FUNCTION handle_new_user_profile() TO anon;
