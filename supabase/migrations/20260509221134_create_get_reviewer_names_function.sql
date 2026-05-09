/*
  # Create get_reviewer_names function

  Returns display names for a list of user IDs, checking user_settings first
  and falling back to auth.users metadata. Used by the activity log to show
  which parent approved/rejected a task completion.
*/

CREATE OR REPLACE FUNCTION get_reviewer_names(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, display_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    COALESCE(
      NULLIF(TRIM(us.display_name), ''),
      NULLIF(TRIM(us.full_name), ''),
      NULLIF(TRIM(us.first_name), ''),
      NULLIF(TRIM(u.raw_user_meta_data->>'full_name'), ''),
      NULLIF(TRIM(u.raw_user_meta_data->>'name'), ''),
      SPLIT_PART(u.email, '@', 1)
    ) AS display_name
  FROM auth.users u
  LEFT JOIN user_settings us ON us.id = u.id
  WHERE u.id = ANY(p_user_ids);
END;
$$;

GRANT EXECUTE ON FUNCTION get_reviewer_names(uuid[]) TO authenticated;
