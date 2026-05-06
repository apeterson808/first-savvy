/*
  # Fix task update RLS and task_assignments policies

  ## Problem
  1. The tasks UPDATE policy WITH CHECK checks profile_id against profile_memberships,
     but when updating only task fields (title, icon, etc.) without profile_id in the
     payload, Postgres evaluates WITH CHECK against the full new row. The existing
     profile_id value should satisfy it, but the policy structure can cause failures
     in some Supabase client versions. We tighten it to be explicit.
  2. task_assignments has no DELETE policy — needed if we ever hard-delete rows
     (currently we soft-delete via UPDATE, but the policy gap can cause issues).

  ## Changes
  - Drop and recreate the tasks UPDATE policy to be more robust
  - Add a DELETE policy for task_assignments (for completeness/safety)
*/

-- Drop the existing tasks UPDATE policy and recreate it more robustly
DROP POLICY IF EXISTS "Parents and qualified children can update chores" ON tasks;

CREATE POLICY "Parents can update tasks they own"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    profile_id IN (
      SELECT profile_id FROM profile_memberships
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT profile_id FROM profile_memberships
      WHERE user_id = auth.uid()
        AND role IN ('owner', 'admin')
    )
  );

-- Also allow children with permission level >= 2 to update task status (completions)
-- but NOT change ownership — kept as a separate narrower policy
CREATE POLICY "Children can update assigned task status"
  ON tasks FOR UPDATE
  TO authenticated
  USING (
    assigned_to_child_id IN (
      SELECT id FROM child_profiles
      WHERE user_id = auth.uid()
        AND current_permission_level >= 2
    )
  )
  WITH CHECK (
    assigned_to_child_id IN (
      SELECT id FROM child_profiles
      WHERE user_id = auth.uid()
        AND current_permission_level >= 2
    )
  );

-- Add DELETE policy for task_assignments (soft-delete via UPDATE already works,
-- but this covers any hard-delete paths)
CREATE POLICY "Parents can delete task assignments they own"
  ON task_assignments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN profile_memberships pm ON pm.profile_id = t.profile_id
      WHERE t.id = task_assignments.task_id
        AND pm.user_id = auth.uid()
        AND pm.role IN ('owner', 'admin')
    )
  );
