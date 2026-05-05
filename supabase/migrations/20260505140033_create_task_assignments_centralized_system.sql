/*
  # Centralized Task Assignment System

  ## Overview
  Replaces the per-child task model with a centralized system where:
  - A task definition lives once, owned by the parent profile
  - A `task_assignments` join table links tasks to one or more children
  - Completion tracking remains in `task_completions` (already has child_profile_id)
  - Editing a task updates it for all assigned children instantly
  - Each child's completion is tracked independently — one child completing a task
    has zero effect on any other child's ability to complete the same task

  ## New Tables
  - `task_assignments`
    - `id` (uuid, primary key)
    - `task_id` (uuid, FK to tasks)
    - `child_profile_id` (uuid, FK to child_profiles)
    - `is_active` (boolean) — soft-delete per assignment
    - `created_at` (timestamptz)

  ## Modified Tables
  - `tasks`: `assigned_to_child_id` made nullable (kept for backward compat during migration)
    New index on `profile_id` for efficient parent-level queries.

  ## Data Migration
  Every existing task row that has an `assigned_to_child_id` gets a corresponding
  row inserted into `task_assignments` so no data is lost.

  ## Security
  - RLS enabled on `task_assignments`
  - Parents can manage assignments for tasks they own (via profile_id)
  - Children can read their own assignments

  ## Notes
  - The old `assigned_to_child_id` column is kept nullable for a safe migration;
    the application code stops writing to it going forward.
  - `task_completions` already has `(task_id, child_profile_id)` — no schema
    changes needed there. Each completion row is per-child, fully independent.
*/

-- 1. Make assigned_to_child_id nullable so the column can stay without being required
ALTER TABLE tasks ALTER COLUMN assigned_to_child_id DROP NOT NULL;

-- 2. Create the task_assignments join table
CREATE TABLE IF NOT EXISTS task_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  child_profile_id uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, child_profile_id)
);

-- 3. Index for fast per-child lookups
CREATE INDEX IF NOT EXISTS idx_task_assignments_child ON task_assignments(child_profile_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_task_assignments_task ON task_assignments(task_id) WHERE is_active = true;

-- 4. Index on tasks for fast parent-level queries
CREATE INDEX IF NOT EXISTS idx_tasks_profile ON tasks(profile_id) WHERE is_active = true;

-- 5. Migrate existing data: for every task with an assigned_to_child_id, create the assignment row
INSERT INTO task_assignments (task_id, child_profile_id, is_active, created_at)
SELECT id, assigned_to_child_id, is_active, created_at
FROM tasks
WHERE assigned_to_child_id IS NOT NULL
ON CONFLICT (task_id, child_profile_id) DO NOTHING;

-- 6. Enable RLS
ALTER TABLE task_assignments ENABLE ROW LEVEL SECURITY;

-- 7. Parents can view assignments for tasks they own
CREATE POLICY "Parents can view task assignments they own"
  ON task_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN profiles p ON p.id = t.profile_id
      WHERE t.id = task_assignments.task_id
        AND p.user_id = auth.uid()
    )
  );

-- 8. Parents can insert assignments for tasks they own
CREATE POLICY "Parents can create task assignments they own"
  ON task_assignments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN profiles p ON p.id = t.profile_id
      WHERE t.id = task_assignments.task_id
        AND p.user_id = auth.uid()
    )
  );

-- 9. Parents can update assignments for tasks they own
CREATE POLICY "Parents can update task assignments they own"
  ON task_assignments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN profiles p ON p.id = t.profile_id
      WHERE t.id = task_assignments.task_id
        AND p.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tasks t
      JOIN profiles p ON p.id = t.profile_id
      WHERE t.id = task_assignments.task_id
        AND p.user_id = auth.uid()
    )
  );

-- 10. Children can read their own assignments (needed for child-facing views)
CREATE POLICY "Children can read own task assignments"
  ON task_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM child_profiles cp
      WHERE cp.id = task_assignments.child_profile_id
        AND cp.user_id = auth.uid()
    )
  );
