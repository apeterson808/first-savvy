/*
  # Add function to find a user by email for account linking

  ## Purpose
  Allows looking up an existing user account by email address so that an adult
  family member record (child_profiles with an adult family_role) can be directly
  linked to an existing auth account without going through an email invitation.

  ## New Functions
  - `find_user_by_email(p_email text)` — security definer function that searches
    auth.users and returns the matching user's id, email, and display name from
    user_settings. Only callable by authenticated users.

  ## Security
  - SECURITY DEFINER so it can read auth.users
  - Validates that the caller is authenticated
  - Returns only id, email, display_name — no sensitive fields
*/

CREATE OR REPLACE FUNCTION find_user_by_email(p_email text)
RETURNS TABLE(user_id uuid, email text, display_name text, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only callable by authenticated users
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  RETURN QUERY
    SELECT
      au.id AS user_id,
      au.email::text,
      COALESCE(us.display_name, us.full_name, au.email)::text AS display_name,
      COALESCE(us.full_name, '')::text AS full_name
    FROM auth.users au
    LEFT JOIN user_settings us ON us.id = au.id
    WHERE lower(au.email) = lower(p_email)
    LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION find_user_by_email(text) TO authenticated;
