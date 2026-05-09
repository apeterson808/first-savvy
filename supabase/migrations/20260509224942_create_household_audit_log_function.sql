/*
  # Create Household Audit Log Function

  ## Purpose
  A single server-side function that writes to audit_logs with full actor
  attribution. Called from any context (client or trigger) to record who did
  what within a household profile.

  ## New Function: log_household_action
  Parameters:
  - p_profile_id: the household profile the action belongs to
  - p_user_id: the authenticated user who performed the action
  - p_actor_display_name: cached display name for quick UI rendering
  - p_action: action code (e.g. 'categorize_transaction', 'create_budget')
  - p_entity_type: the table/object type (e.g. 'transaction', 'budget')
  - p_entity_id: the UUID of the affected record
  - p_description: human-readable summary of what happened
  - p_metadata: optional jsonb for additional context (old/new values, etc.)

  ## Security
  SECURITY DEFINER so it can be called by any authenticated household member.
  Validates that the caller is actually a member of the profile before writing.
*/

CREATE OR REPLACE FUNCTION log_household_action(
  p_profile_id uuid,
  p_user_id uuid,
  p_actor_display_name text,
  p_action text,
  p_entity_type text,
  p_entity_id uuid DEFAULT NULL,
  p_description text DEFAULT '',
  p_metadata jsonb DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  -- Only write if the caller is a member of this profile
  IF NOT EXISTS (
    SELECT 1 FROM profile_memberships
    WHERE profile_id = p_profile_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to log actions for this profile';
  END IF;

  INSERT INTO audit_logs (
    profile_id,
    user_id,
    actor_display_name,
    action,
    entity_type,
    entity_id,
    description,
    metadata
  ) VALUES (
    p_profile_id,
    p_user_id,
    p_actor_display_name,
    p_action,
    p_entity_type,
    p_entity_id,
    p_description,
    p_metadata
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$;

-- Allow authenticated users to execute this function
GRANT EXECUTE ON FUNCTION log_household_action TO authenticated;

/*
  # Create Function: get_household_activity_feed

  Returns paginated activity log for a household profile, joining display names
  for all household members so the UI can show "Jenna approved..." correctly.
*/

CREATE OR REPLACE FUNCTION get_household_activity_feed(
  p_profile_id uuid,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_entity_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  action text,
  entity_type text,
  entity_id uuid,
  description text,
  metadata jsonb,
  actor_user_id uuid,
  actor_display_name text,
  created_at timestamptz,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller has access to this profile
  IF NOT EXISTS (
    SELECT 1 FROM profile_memberships
    WHERE profile_id = p_profile_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not authorized to view activity for this profile';
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.action,
    al.entity_type,
    al.entity_id,
    al.description,
    al.metadata,
    al.user_id AS actor_user_id,
    COALESCE(al.actor_display_name, us.display_name, 'Unknown') AS actor_display_name,
    al.created_at,
    COUNT(*) OVER() AS total_count
  FROM audit_logs al
  LEFT JOIN user_settings us ON us.id = al.user_id
  WHERE al.profile_id = p_profile_id
    AND (p_entity_type IS NULL OR al.entity_type = p_entity_type)
  ORDER BY al.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_household_activity_feed TO authenticated;

-- RLS on audit_logs: household members can view their profile's logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Household members can view audit logs" ON audit_logs;
CREATE POLICY "Household members can view audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships
      WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Authenticated users can insert audit logs via function" ON audit_logs;
CREATE POLICY "Authenticated users can insert audit logs via function"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT profile_id FROM profile_memberships
      WHERE user_id = auth.uid()
    )
  );
