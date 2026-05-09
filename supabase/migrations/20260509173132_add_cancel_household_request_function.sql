/*
  # Add cancel_household_request function

  Allows the requester to withdraw their own pending household join request,
  resetting their profile's household_status back to NULL so they can use
  the app as an independent user.
*/

CREATE OR REPLACE FUNCTION cancel_household_request()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_request_id uuid;
  v_requester_profile_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Find the user's pending request
  SELECT id INTO v_request_id
  FROM household_join_requests
  WHERE requester_user_id = v_user_id AND status = 'pending'
  LIMIT 1;

  IF v_request_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'note', 'No pending request found');
  END IF;

  -- Update request status to cancelled
  UPDATE household_join_requests
  SET status = 'cancelled', updated_at = now()
  WHERE id = v_request_id;

  -- Reset the user's own profile household_status
  SELECT p.id INTO v_requester_profile_id
  FROM profile_memberships pm
  JOIN profiles p ON p.id = pm.profile_id
  WHERE pm.user_id = v_user_id
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

GRANT EXECUTE ON FUNCTION cancel_household_request() TO authenticated;
