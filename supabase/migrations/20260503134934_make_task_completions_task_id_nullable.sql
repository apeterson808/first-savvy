/*
  # Make task_id nullable in task_completions

  ## Summary
  Allows task_completions to record one-time direct star awards that are not
  tied to any specific task. Previously task_id was NOT NULL, so awardStarsDirectly
  with no taskId had no way to log the award, causing it to be invisible in the
  activity log.

  ## Changes
  - `task_completions.task_id` — drops NOT NULL constraint, making it nullable
  - Existing rows are unaffected (they all have task_id values)
*/

ALTER TABLE task_completions ALTER COLUMN task_id DROP NOT NULL;
