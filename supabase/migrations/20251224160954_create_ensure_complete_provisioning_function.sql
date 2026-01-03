/*
  # Create ensure_complete_provisioning() RPC Function

  ## Overview
  Creates a guaranteed provisioning function that ensures every user has:
  - Exactly one personal profile
  - Exactly one owner membership
  - Exactly one active tab pointing to their personal profile

  ## Process
  1. Check if personal profile exists
  2. If not, create personal profile
  3. Check if owner membership exists
  4. If not, create owner membership
  5. Check if active tab exists
  6. If not, create active tab
  7. Return success and all IDs

  ## Safety
  - Idempotent: Can be run multiple times safely
  - Enforces "one default personal profile" in logic only (no DB constraint)
  - Does not modify existing profiles
  - Creates missing components only

  ## Returns
  JSON object with:
  - success: boolean
  - profile_id: uuid
  - membership_id: uuid
  - tab_id: uuid
  - created_profile: boolean
  - created_membership: boolean
  - created_tab: boolean
*/

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

  SELECT id INTO v_tab_id
  FROM profile_tabs
  WHERE user_id = v_user_id
    AND owner_user_id = v_profile_id
  LIMIT 1;

  IF v_tab_id IS NULL THEN
    INSERT INTO profile_tabs (user_id, owner_user_id, display_name, is_active)
    VALUES (v_user_id, v_profile_id, 'Personal', true)
    RETURNING id INTO v_tab_id;

    v_created_tab := true;
  ELSE
    UPDATE profile_tabs
    SET is_active = true
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

GRANT EXECUTE ON FUNCTION ensure_complete_provisioning() TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_complete_provisioning() TO anon;
