/*
  # approve_household_request function

  Called by the profile owner to approve a pending join request.

  Actions performed atomically:
  1. Validates the caller owns the target profile
  2. Sets request status = 'approved', role = p_role
  3. Inserts a profile_memberships row for the requester
     - spouse_full  → role = 'member'  (full read/write access, same profile)
     - spouse_view  → role = 'viewer'  (read-only access)
  4. Creates a contact in the OWNER's profile for the requester
  5. Creates a contact in the REQUESTER's own profile for the owner

  Returns jsonb with success flag and the membership role granted.
*/

CREATE OR REPLACE FUNCTION public.approve_household_request(
  p_request_id uuid,
  p_role text  -- 'spouse_full' | 'spouse_view'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_req household_join_requests%ROWTYPE;
  v_membership_role text;
  v_owner_profile_id uuid;
  v_requester_own_profile_id uuid;
  v_owner_display_name text;
  v_owner_email text;
  v_owner_phone text;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF p_role NOT IN ('spouse_full', 'spouse_view') THEN RAISE EXCEPTION 'Invalid role'; END IF;

  -- Load the request
  SELECT * INTO v_req FROM household_join_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or already processed'; END IF;

  -- Confirm caller owns the target profile
  SELECT profile_id INTO v_owner_profile_id
  FROM profile_memberships
  WHERE user_id = v_caller AND role = 'owner' AND profile_id = v_req.target_profile_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not authorized'; END IF;

  -- Determine membership role
  v_membership_role := CASE p_role WHEN 'spouse_full' THEN 'member' ELSE 'viewer' END;

  -- Mark request approved
  UPDATE household_join_requests
  SET status = 'approved', role = p_role, updated_at = now()
  WHERE id = p_request_id;

  -- Add membership (idempotent)
  INSERT INTO profile_memberships (user_id, profile_id, role)
  VALUES (v_req.requester_user_id, v_req.target_profile_id, v_membership_role)
  ON CONFLICT DO NOTHING;

  -- Get owner's info for creating contact in requester's profile
  SELECT us.display_name, au.email, us.phone
  INTO v_owner_display_name, v_owner_email, v_owner_phone
  FROM auth.users au
  LEFT JOIN user_settings us ON us.id = au.id
  WHERE au.id = v_caller;

  -- Get requester's own profile id
  SELECT profile_id INTO v_requester_own_profile_id
  FROM profile_memberships
  WHERE user_id = v_req.requester_user_id AND role = 'owner'
  LIMIT 1;

  -- Create contact in owner's profile for the requester (family section)
  INSERT INTO contacts (profile_id, name, email, type, group_name, linked_user_id, connection_status)
  VALUES (
    v_owner_profile_id,
    v_req.requester_display_name,
    v_req.requester_email,
    'person',
    CASE p_role WHEN 'spouse_full' THEN 'Spouse / Partner' ELSE 'Spouse / Partner' END,
    v_req.requester_user_id,
    'connected'
  )
  ON CONFLICT DO NOTHING;

  -- Create contact in requester's own profile for the owner
  IF v_requester_own_profile_id IS NOT NULL THEN
    INSERT INTO contacts (profile_id, name, email, phone, type, group_name, linked_user_id, connection_status)
    VALUES (
      v_requester_own_profile_id,
      COALESCE(v_owner_display_name, v_owner_email),
      v_owner_email,
      v_owner_phone,
      'person',
      CASE p_role WHEN 'spouse_full' THEN 'Spouse / Partner' ELSE 'Spouse / Partner' END,
      v_caller,
      'connected'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'membership_role', v_membership_role,
    'requester_display_name', v_req.requester_display_name
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_household_request(uuid, text) TO authenticated;

-- Also create a simple decline function
CREATE OR REPLACE FUNCTION public.decline_household_request(p_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_req household_join_requests%ROWTYPE;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  SELECT * INTO v_req FROM household_join_requests WHERE id = p_request_id AND status = 'pending';
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found or already processed'; END IF;

  -- Confirm caller owns the target profile
  IF NOT EXISTS (
    SELECT 1 FROM profile_memberships
    WHERE user_id = v_caller AND role = 'owner' AND profile_id = v_req.target_profile_id
  ) THEN RAISE EXCEPTION 'Not authorized'; END IF;

  UPDATE household_join_requests
  SET status = 'declined', updated_at = now()
  WHERE id = p_request_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.decline_household_request(uuid) TO authenticated;

-- Also create a function to send a join request (bypasses RLS cleanly)
CREATE OR REPLACE FUNCTION public.request_join_household(
  p_owner_user_id uuid,
  p_requester_display_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_email text;
  v_target_profile_id uuid;
  v_existing_id uuid;
BEGIN
  IF v_caller IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF v_caller = p_owner_user_id THEN RAISE EXCEPTION 'Cannot join your own household'; END IF;

  -- Get caller email
  SELECT email INTO v_caller_email FROM auth.users WHERE id = v_caller;

  -- Find owner's profile
  SELECT profile_id INTO v_target_profile_id
  FROM profile_memberships
  WHERE user_id = p_owner_user_id AND role = 'owner'
  LIMIT 1;
  IF NOT FOUND THEN RAISE EXCEPTION 'Target user has no profile'; END IF;

  -- Already a member?
  IF EXISTS (SELECT 1 FROM profile_memberships WHERE user_id = v_caller AND profile_id = v_target_profile_id) THEN
    RETURN jsonb_build_object('success', true, 'already_member', true);
  END IF;

  -- Already pending?
  SELECT id INTO v_existing_id
  FROM household_join_requests
  WHERE requester_user_id = v_caller AND target_profile_id = v_target_profile_id AND status = 'pending';

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'already_pending', true, 'request_id', v_existing_id);
  END IF;

  INSERT INTO household_join_requests (requester_user_id, requester_email, requester_display_name, target_profile_id)
  VALUES (v_caller, v_caller_email, p_requester_display_name, v_target_profile_id)
  RETURNING id INTO v_existing_id;

  RETURN jsonb_build_object('success', true, 'already_pending', false, 'request_id', v_existing_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.request_join_household(uuid, text) TO authenticated;
