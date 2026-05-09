/*
  # Fix approve/reject task completion RPCs

  1. approve_task_completion - was not setting reviewed_by at all; fixed to set it
  2. reject_task_completion - authorization check used profiles.user_id = auth.uid()
     which blocked household members (role='member'); fixed to use profile_memberships
*/

CREATE OR REPLACE FUNCTION approve_task_completion(
  p_completion_id uuid,
  p_review_notes  text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completion  task_completions%ROWTYPE;
  v_task        tasks%ROWTYPE;
  v_child_stars int;
  v_new_balance int;
  v_new_status  text;
BEGIN
  SELECT * INTO v_completion
  FROM task_completions
  WHERE id = p_completion_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'completion not found: %', p_completion_id;
  END IF;

  SELECT * INTO v_task
  FROM tasks
  WHERE id = v_completion.task_id;

  -- Allow if no task (direct star award) or if caller is a household member
  IF v_task.id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM child_profiles cp
      JOIN profile_memberships pm ON pm.profile_id = cp.parent_profile_id
      WHERE cp.id = v_completion.child_profile_id
        AND pm.user_id = auth.uid()
        AND cp.is_active = true
    ) THEN
      RAISE EXCEPTION 'Not authorized to approve this completion';
    END IF;
  END IF;

  UPDATE task_completions
  SET
    status       = 'approved',
    reviewed_at  = now(),
    reviewed_by  = auth.uid(),
    review_notes = p_review_notes
  WHERE id = p_completion_id;

  SELECT stars_balance INTO v_child_stars
  FROM child_profiles
  WHERE id = v_completion.child_profile_id;

  v_new_balance := COALESCE(v_child_stars, 0) + COALESCE(v_completion.stars_earned, 0);

  UPDATE child_profiles
  SET
    stars_balance = v_new_balance,
    stars_pending = GREATEST(0, COALESCE(stars_pending, 0) - COALESCE(v_completion.stars_earned, 0))
  WHERE id = v_completion.child_profile_id;

  IF v_task.id IS NOT NULL THEN
    IF v_task.reset_mode = 'instant'
    OR v_task.repeatable = true
    OR v_task.frequency  = 'always_available'
    THEN
      v_new_status := 'in_progress';
    ELSE
      v_new_status := 'approved';
    END IF;

    UPDATE tasks
    SET
      status       = v_new_status,
      approved_at  = now(),
      completed_at = NULL
    WHERE id = v_task.id;
  END IF;

  RETURN json_build_object(
    'ok',            true,
    'stars_balance', v_new_balance,
    'task_status',   v_new_status
  );
END;
$$;

CREATE OR REPLACE FUNCTION reject_task_completion(
  p_completion_id uuid,
  p_review_notes  text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_completion   task_completions;
  v_child_profile child_profiles;
  v_result       json;
BEGIN
  SELECT * INTO v_completion
  FROM task_completions
  WHERE id = p_completion_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Task completion not found';
  END IF;

  -- Allow household members (any role) to reject, not just the profile owner
  SELECT cp.* INTO v_child_profile
  FROM child_profiles cp
  JOIN profile_memberships pm ON pm.profile_id = cp.parent_profile_id
  WHERE cp.id = v_completion.child_profile_id
    AND pm.user_id = auth.uid()
    AND cp.is_active = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Not authorized to reject this completion';
  END IF;

  IF v_completion.status != 'pending' THEN
    RAISE EXCEPTION 'Task completion already reviewed';
  END IF;

  UPDATE task_completions
  SET
    status       = 'rejected',
    reviewed_at  = now(),
    reviewed_by  = auth.uid(),
    review_notes = p_review_notes,
    updated_at   = now()
  WHERE id = p_completion_id;

  UPDATE child_profiles
  SET
    stars_pending = GREATEST(0, stars_pending - v_completion.stars_earned),
    updated_at    = now()
  WHERE id = v_completion.child_profile_id;

  SELECT json_build_object(
    'stars_balance', stars_balance,
    'stars_pending', stars_pending
  ) INTO v_result
  FROM child_profiles
  WHERE id = v_completion.child_profile_id;

  RETURN v_result;
END;
$$;
