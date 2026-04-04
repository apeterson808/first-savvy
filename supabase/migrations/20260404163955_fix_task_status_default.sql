/*
  # Fix Task Status Default

  1. Changes
    - Update default status for tasks from 'pending' to 'in_progress'
    - Update existing parent-created tasks from 'pending' to 'in_progress'

  2. Reasoning
    - When parents create tasks, they should be immediately active/available
    - 'pending' status should only be used for child-created tasks awaiting approval
    - Status workflow: in_progress → completed (by child) → approved (by parent)
*/

-- Update existing parent-created tasks that are still pending
UPDATE tasks
SET status = 'in_progress'
WHERE status = 'pending'
  AND is_active = true;

-- Change the default status for new tasks
ALTER TABLE tasks
ALTER COLUMN status SET DEFAULT 'in_progress';
