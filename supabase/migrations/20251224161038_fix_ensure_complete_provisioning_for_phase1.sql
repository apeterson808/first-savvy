/*
  # Fix ensure_complete_provisioning for Phase 1

  ## Overview
  Updates the ensure_complete_provisioning() function to work correctly
  with the Phase 1 schema and requirements.

  ## Changes
  - Creates one personal profile if none exists
  - Creates owner membership
  - Creates active tab linked to the profile
  - Returns detailed success info

  ## Safety
  - Idempotent
  - No unique constraints on profiles (flexible for Phase 2)
  - Uses correct foreign key relationships for profile_tabs
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
    UPDATE profile_tabs
    SET is_active = false
    WHERE user_id = v_user_id;

    INSERT INTO profile_tabs (user_id, owner_user_id, display_name, is_active)
    VALUES (v_user_id, v_profile_id, 'Personal', true)
    RETURNING id INTO v_tab_id;

    v_created_tab := true;
  ELSE
    UPDATE profile_tabs
    SET is_active = false
    WHERE user_id = v_user_id
      AND id != v_tab_id;

    UPDATE profile_tabs
    SET is_active = true
    WHERE id = v_tab_id;
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
