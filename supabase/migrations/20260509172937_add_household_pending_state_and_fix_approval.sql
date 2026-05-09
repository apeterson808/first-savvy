/*
  # Household Pending State & Approval Overhaul

  ## Summary
  Rebuilds the household joining flow so that:
  1. When a user requests to join a household, their own profile is marked with
     `household_status = 'pending'` — they see a waiting screen, not the full app.
  2. On approval, their own profile is soft-deleted and they are added as a member
     of the shared household profile.
  3. On decline, their own profile's `household_status` is reset to NULL so they
     can use the app independently.

  ## Changes
  - `profiles` — adds `household_status` column (NULL | 'pending' | 'approved')
  - Rebuilds request_join_household, approve_household_request, decline_household_request
*/

-- 1. Add household_status to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'household_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN household_status text DEFAULT NULL;
  END IF;
END $$;

-- 2. Drop old functions before recreating with potentially different signatures/return types
DROP FUNCTION IF EXISTS decline_household_request(uuid);
DROP FUNCTION IF EXISTS approve_household_request(uuid, text);
DROP FUNCTION IF EXISTS request_join_household(uuid, text);

-- 3. request_join_household — marks requester's profile as pending
CREATE FUNCTION request_join_household(
  p_owner_user_id uuid,
  p_requester_display_name text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_requester_user_id uuid;
  v_requester_email text;
  v_owner_profile_id uuid;
  v_requester_profile_id uuid;
  v_existing_member boolean := false;
  v_already_pending boolean := false;
BEGIN
  v_requester_user_id := auth.uid();
  IF v_requester_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_requester_user_id = p_owner_user_id THEN
    RAISE EXCEPTION 'Cannot join your own household';
  END IF;

  SELECT email INTO v_requester_email
  FROM auth.users WHERE id = v_requester_user_id;

  SELECT pm.profile_id INTO v_owner_profile_id
  FROM profile_memberships pm
  JOIN profiles p ON p.id = pm.profile_id
  WHERE pm.user_id = p_owner_user_id
    AND pm.role = 'owner'
    AND p.is_deleted = false
    AND p.profile_type = 'personal'
  LIMIT 1;

  IF v_owner_profile_id IS NULL THEN
    RAISE EXCEPTION 'Owner profile not found';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM profile_memberships
    WHERE user_id = v_requester_user_id
      AND profile_id = v_owner_profile_id
      AND role IN ('member', 'viewer')
  ) INTO v_existing_member;

  IF v_existing_member THEN
    RETURN jsonb_build_object('already_member', true);
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM household_join_requests
    WHERE requester_user_id = v_requester_user_id
      AND target_profile_id = v_owner_profile_id
      AND status = 'pending'
  ) INTO v_already_pending;

  IF v_already_pending THEN
    RETURN jsonb_build_object('already_pending', true);
  END IF;

  SELECT p.id INTO v_requester_profile_id
  FROM profile_memberships pm
  JOIN profiles p ON p.id = pm.profile_id
  WHERE pm.user_id = v_requester_user_id
    AND pm.role = 'owner'
    AND p.is_deleted = false
  LIMIT 1;

  INSERT INTO household_join_requests (
    requester_user_id,
    requester_email,
    requester_display_name,
    target_profile_id,
    status
  ) VALUES (
    v_requester_user_id,
    v_requester_email,
    COALESCE(p_requester_display_name, v_requester_email),
    v_owner_profile_id,
    'pending'
  );

  IF v_requester_profile_id IS NOT NULL THEN
    UPDATE profiles
    SET household_status = 'pending'
    WHERE id = v_requester_profile_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'already_member', false, 'already_pending', false);
END;
$$;

-- 4. approve_household_request — soft-deletes requester's own profile on approval
CREATE FUNCTION approve_household_request(
  p_request_id uuid,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_request household_join_requests%ROWTYPE;
  v_owner_profile_id uuid;
  v_requester_profile_id uuid;
  v_membership_role text;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_role NOT IN ('spouse_full', 'spouse_view') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  SELECT * INTO v_request
  FROM household_join_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already resolved';
  END IF;

  SELECT pm.profile_id INTO v_owner_profile_id
  FROM profile_memberships pm
  WHERE pm.user_id = v_caller_id
    AND pm.profile_id = v_request.target_profile_id
    AND pm.role = 'owner';

  IF v_owner_profile_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  v_membership_role := CASE WHEN p_role = 'spouse_full' THEN 'member' ELSE 'viewer' END;

  UPDATE household_join_requests
  SET status = 'approved', role = p_role, updated_at = now()
  WHERE id = p_request_id;

  INSERT INTO profile_memberships (user_id, profile_id, role)
  VALUES (v_request.requester_user_id, v_owner_profile_id, v_membership_role)
  ON CONFLICT (user_id, profile_id) DO UPDATE SET role = EXCLUDED.role;

  -- Soft-delete requester's own profile
  SELECT p.id INTO v_requester_profile_id
  FROM profile_memberships pm
  JOIN profiles p ON p.id = pm.profile_id
  WHERE pm.user_id = v_request.requester_user_id
    AND pm.role = 'owner'
    AND p.is_deleted = false
  LIMIT 1;

  IF v_requester_profile_id IS NOT NULL THEN
    UPDATE profiles
    SET is_deleted = true, household_status = 'approved'
    WHERE id = v_requester_profile_id;
  END IF;

  -- Add requester as contact on owner's profile
  INSERT INTO contacts (profile_id, name, email, type, group_name, connection_status, linked_user_id)
  SELECT
    v_owner_profile_id,
    COALESCE(v_request.requester_display_name, v_request.requester_email),
    v_request.requester_email,
    'person',
    'Spouse / Partner',
    'connected',
    v_request.requester_user_id
  WHERE NOT EXISTS (
    SELECT 1 FROM contacts
    WHERE profile_id = v_owner_profile_id AND linked_user_id = v_request.requester_user_id
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- 5. decline_household_request — resets pending status so requester can use app independently
CREATE FUNCTION decline_household_request(
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller_id uuid;
  v_request household_join_requests%ROWTYPE;
  v_owner_profile_id uuid;
  v_requester_profile_id uuid;
BEGIN
  v_caller_id := auth.uid();
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_request
  FROM household_join_requests
  WHERE id = p_request_id AND status = 'pending';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found or already resolved';
  END IF;

  SELECT pm.profile_id INTO v_owner_profile_id
  FROM profile_memberships pm
  WHERE pm.user_id = v_caller_id
    AND pm.profile_id = v_request.target_profile_id
    AND pm.role = 'owner';

  IF v_owner_profile_id IS NULL THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  UPDATE household_join_requests
  SET status = 'declined', updated_at = now()
  WHERE id = p_request_id;

  -- Reset pending so requester can use app as independent user
  SELECT p.id INTO v_requester_profile_id
  FROM profile_memberships pm
  JOIN profiles p ON p.id = pm.profile_id
  WHERE pm.user_id = v_request.requester_user_id
    AND pm.role = 'owner'
    AND p.is_deleted = false
  LIMIT 1;

  IF v_requester_profile_id IS NOT NULL THEN
    UPDATE profiles SET household_status = NULL
    WHERE id = v_requester_profile_id;
  END IF;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION request_join_household(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_household_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION decline_household_request(uuid) TO authenticated;
