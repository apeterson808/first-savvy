/*
  # Add join_household function

  Allows an authenticated user to add themselves as a member of another user's
  profile. This is needed for the onboarding "connect to household" step where
  a new user (e.g. Jenna) wants to join an existing user's (e.g. Andrew's) profile.

  Security:
  - SECURITY DEFINER so it can bypass the RLS INSERT policy (which only allows
    profile owners to insert memberships).
  - Validates that the target profile exists and is owned by a real user.
  - Only inserts if the caller is not already a member.
  - The caller can only add themselves (auth.uid()), never a third party.
*/

CREATE OR REPLACE FUNCTION public.join_household(p_owner_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_caller_id uuid := auth.uid();
  v_profile_id uuid;
  v_existing_id uuid;
BEGIN
  IF v_caller_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF v_caller_id = p_owner_user_id THEN
    RAISE EXCEPTION 'Cannot join your own household';
  END IF;

  -- Find the owner profile for the target user
  SELECT profile_id INTO v_profile_id
  FROM profile_memberships
  WHERE user_id = p_owner_user_id AND role = 'owner'
  LIMIT 1;

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Target user has no profile';
  END IF;

  -- Idempotent: skip if already a member
  SELECT id INTO v_existing_id
  FROM profile_memberships
  WHERE user_id = v_caller_id AND profile_id = v_profile_id
  LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN jsonb_build_object('profile_id', v_profile_id, 'already_member', true);
  END IF;

  INSERT INTO profile_memberships (user_id, profile_id, role)
  VALUES (v_caller_id, v_profile_id, 'member');

  RETURN jsonb_build_object('profile_id', v_profile_id, 'already_member', false);
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_household(uuid) TO authenticated;
