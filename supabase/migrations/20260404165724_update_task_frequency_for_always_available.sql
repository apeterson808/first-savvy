/*
  # Update Task Frequency to Support Always Available Tasks

  1. Changes
    - Update the `frequency` column CHECK constraint on `tasks` table
    - Add 'always_available' as a valid frequency option
    - This allows tasks to be always visible and completable by children
    - Tasks with 'always_available' frequency are repeatable and don't reset

  2. Notes
    - Existing tasks with 'one_time', 'daily', or 'weekly' remain unchanged
    - New tasks can be set to 'always_available' for persistent task lists
*/

-- Drop the existing constraint on the frequency column
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_frequency_check;

-- Add updated constraint with 'always_available' option
ALTER TABLE tasks ADD CONSTRAINT tasks_frequency_check 
  CHECK (frequency IN ('daily', 'weekly', 'one_time', 'always_available'));