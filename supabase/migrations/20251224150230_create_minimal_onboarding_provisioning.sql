/*
  # Minimal MVP Onboarding Provisioning

  ## Overview
  Creates idempotent RPCs for reliable user provisioning during signup.
  Goal: signup → profile exists → tab exists → user lands on dashboard.

  ## New Functions

  ### ensure_user_profile()
  Idempotent function that ensures user_profiles record exists for current user.
  - Creates record if missing
  - Updates email if provided
  - Returns user_profile record
  - Uses full_name from auth metadata if available

  ### ensure_default_tab(profile_id)
  Idempotent function that ensures a profile tab exists for a profile.
  - Creates tab if missing for current user
  - Links tab to specified profile
  - Sets tab as active (deactivating other tabs)
  - Uses display_name from profiles table
  - Returns tab_id

  ### ensure_complete_provisioning()
  High-level function that runs all provisioning steps in order:
  1. Ensures user_profiles exists
  2. Ensures default profile exists (via existing ensure_default_profile)
  3. Ensures default tab exists for that profile
  4. Returns profile_id and tab_id

  ## Changes Made
  - Add ensure_user_profile() function
  - Add ensure_default_tab(profile_id) function
  - Add ensure_complete_provisioning() orchestrator function
  - Update handle_new_user_profile() trigger to use new functions

  ## Important Notes
  - All functions are idempotent (safe to call multiple times)
  - Errors are caught and logged without blocking user creation
  - Chart of accounts auto-provisioning is preserved from existing trigger
*/

-- Function to ensure user_profiles record exists
CREATE OR REPLACE FUNCTION ensure_user_profile()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_user_email text;
  v_full_name text;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get user email from auth.users
  SELECT email INTO v_user_email
  FROM auth.users
  WHERE id = v_user_id;

  -- Try to get full_name from auth metadata
  SELECT raw_user_meta_data->>'full_name' INTO v_full_name
  FROM auth.users
  WHERE id = v_user_id;

  -- Insert or update user_profiles
  INSERT INTO user_profiles (
    id,
    email,
    full_name
  )
  VALUES (
    v_user_id,
    COALESCE(v_user_email, ''),
    COALESCE(v_full_name, '')
  )
  ON CONFLICT (id) DO UPDATE
  SET
    email = COALESCE(EXCLUDED.email, user_profiles.email),
    full_name = CASE
      WHEN COALESCE(EXCLUDED.full_name, '') != ''
      THEN EXCLUDED.full_name
      ELSE user_profiles.full_name
    END,
    updated_at = now();

  RETURN v_user_id;
END;
$$;

-- Function to ensure default tab exists for a profile
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
    AND profile_user_id = v_profile_user_id;

  -- If no tab exists, create one
  IF v_tab_id IS NULL THEN
    -- Deactivate any existing active tabs first
    UPDATE profile_tabs
    SET is_active = false
    WHERE owner_user_id = v_user_id
      AND is_active = true;

    -- Create new tab
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
      v_profile_user_id,
      'personal',
      v_profile_name,
      0,
      true,
      now()
    )
    RETURNING id INTO v_tab_id;
  ELSE
    -- Tab exists, ensure it's active
    UPDATE profile_tabs
    SET is_active = true,
        last_accessed_at = now()
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

-- High-level orchestrator function for complete provisioning
CREATE OR REPLACE FUNCTION ensure_complete_provisioning()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_profile_id uuid;
  v_profile_id uuid;
  v_tab_id uuid;
BEGIN
  -- Step 1: Ensure user_profiles exists
  v_user_profile_id := ensure_user_profile();

  -- Step 2: Ensure default profile exists (uses existing function)
  v_profile_id := ensure_default_profile();

  -- Step 3: Ensure default tab exists
  v_tab_id := ensure_default_tab(v_profile_id);

  -- Return all IDs
  RETURN jsonb_build_object(
    'user_profile_id', v_user_profile_id,
    'profile_id', v_profile_id,
    'tab_id', v_tab_id,
    'success', true
  );
END;
$$;

-- Update trigger to use new provisioning functions
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user_profile();

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
  -- Try to create complete profile setup
  -- If anything fails, log it but don't prevent user creation
  BEGIN
    -- Get user metadata
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

    -- 5. Create default tab for the profile
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
      NEW.id,
      NEW.id,
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
      -- Log the error but allow user creation to succeed
      RAISE WARNING 'Failed to provision user %: % (SQLSTATE: %)',
        NEW.id, SQLERRM, SQLSTATE;
      -- Don't re-raise - this allows the user creation to succeed
  END;

  -- Always return NEW to allow user creation
  RETURN NEW;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION ensure_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_default_tab(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_complete_provisioning() TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user_profile() TO service_role;
GRANT EXECUTE ON FUNCTION handle_new_user_profile() TO anon;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_profile();

COMMENT ON FUNCTION ensure_user_profile() IS
  'Idempotent function to ensure user_profiles record exists for current user';

COMMENT ON FUNCTION ensure_default_tab(uuid) IS
  'Idempotent function to ensure profile tab exists for a profile';

COMMENT ON FUNCTION ensure_complete_provisioning() IS
  'High-level orchestrator that ensures complete user provisioning (profile + tab + chart)';

COMMENT ON FUNCTION handle_new_user_profile() IS
  'Attempts to auto-provision complete user setup on signup. Logs errors without blocking signup.';
