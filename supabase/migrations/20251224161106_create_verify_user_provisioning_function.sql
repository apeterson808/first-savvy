/*
  # Create verify_user_provisioning() RPC Function

  ## Overview
  Verification function that checks if user provisioning is complete.
  Returns detailed diagnostics for development and debugging.

  ## Checks
  1. Count personal profiles for user (should be exactly 1)
  2. Count owner memberships (should be exactly 1)
  3. Count active tabs (should be exactly 1)
  4. Check active tab points to personal profile
  5. Validate all relationships are correct

  ## Returns
  JSON object with:
  - success: boolean (true if all checks pass)
  - personal_profile_count: int
  - owner_membership_count: int
  - active_tab_count: int
  - active_tab_links_to_profile: boolean
  - profile_id: uuid (if exists)
  - tab_id: uuid (if exists)
  - diagnostics: text (detailed info for debugging)

  ## Usage
  Called:
  - Immediately after ensure_complete_provisioning()
  - When ProfileContext loads and finds zero profiles
  - NOT on every app load in production
*/

CREATE OR REPLACE FUNCTION verify_user_provisioning()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile_count int;
  v_membership_count int;
  v_active_tab_count int;
  v_profile_id uuid;
  v_tab_id uuid;
  v_tab_profile_id uuid;
  v_diagnostics text := '';
  v_success boolean := true;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User not authenticated',
      'diagnostics', 'No authenticated user found'
    );
  END IF;

  SELECT COUNT(*), MAX(id)
  INTO v_profile_count, v_profile_id
  FROM profiles
  WHERE user_id = v_user_id
    AND profile_type = 'personal'
    AND is_deleted = false;

  v_diagnostics := v_diagnostics || format('Personal profiles: %s | ', v_profile_count);

  IF v_profile_count = 0 THEN
    v_success := false;
    v_diagnostics := v_diagnostics || 'ERROR: No personal profile found | ';
  ELSIF v_profile_count > 1 THEN
    v_success := false;
    v_diagnostics := v_diagnostics || format('ERROR: Multiple personal profiles found (%s) | ', v_profile_count);
  ELSE
    v_diagnostics := v_diagnostics || format('Profile ID: %s | ', v_profile_id);
  END IF;

  SELECT COUNT(*)
  INTO v_membership_count
  FROM profile_memberships
  WHERE user_id = v_user_id
    AND profile_id = v_profile_id
    AND role = 'owner';

  v_diagnostics := v_diagnostics || format('Owner memberships: %s | ', v_membership_count);

  IF v_membership_count = 0 THEN
    v_success := false;
    v_diagnostics := v_diagnostics || 'ERROR: No owner membership found | ';
  ELSIF v_membership_count > 1 THEN
    v_success := false;
    v_diagnostics := v_diagnostics || format('ERROR: Multiple owner memberships found (%s) | ', v_membership_count);
  END IF;

  SELECT COUNT(*), MAX(id), MAX(owner_user_id)
  INTO v_active_tab_count, v_tab_id, v_tab_profile_id
  FROM profile_tabs
  WHERE user_id = v_user_id
    AND is_active = true;

  v_diagnostics := v_diagnostics || format('Active tabs: %s | ', v_active_tab_count);

  IF v_active_tab_count = 0 THEN
    v_success := false;
    v_diagnostics := v_diagnostics || 'ERROR: No active tab found | ';
  ELSIF v_active_tab_count > 1 THEN
    v_success := false;
    v_diagnostics := v_diagnostics || format('ERROR: Multiple active tabs found (%s) | ', v_active_tab_count);
  ELSE
    v_diagnostics := v_diagnostics || format('Tab ID: %s | ', v_tab_id);

    IF v_tab_profile_id = v_profile_id THEN
      v_diagnostics := v_diagnostics || 'Tab correctly points to profile | ';
    ELSE
      v_success := false;
      v_diagnostics := v_diagnostics || format('ERROR: Tab points to wrong profile (tab: %s, profile: %s) | ',
        v_tab_profile_id, v_profile_id);
    END IF;
  END IF;

  IF v_success THEN
    v_diagnostics := v_diagnostics || 'All checks passed!';
  END IF;

  RETURN jsonb_build_object(
    'success', v_success,
    'user_id', v_user_id,
    'personal_profile_count', v_profile_count,
    'owner_membership_count', v_membership_count,
    'active_tab_count', v_active_tab_count,
    'profile_id', v_profile_id,
    'tab_id', v_tab_id,
    'active_tab_links_to_profile', (v_tab_profile_id = v_profile_id),
    'diagnostics', v_diagnostics
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', SQLERRM,
      'diagnostics', format('Exception occurred: %s', SQLERRM)
    );
END;
$$;

GRANT EXECUTE ON FUNCTION verify_user_provisioning() TO authenticated;

COMMENT ON FUNCTION verify_user_provisioning() IS
  'Verifies that user provisioning is complete. Returns detailed diagnostics. Call after provisioning or when debugging.';
