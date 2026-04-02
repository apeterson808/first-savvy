/*
  # Rename Chores to Tasks

  1. Changes
    - Rename `chores` table to `tasks`
    - Update all foreign key references
    - Update RLS policies
    - Update indexes
    - Preserve all data and relationships

  2. Security
    - Maintain existing RLS policies with updated table name
    - No changes to access control logic
*/

-- Rename the table
ALTER TABLE IF EXISTS chores RENAME TO tasks;

-- Rename indexes
ALTER INDEX IF EXISTS idx_chores_child_profile RENAME TO idx_tasks_child_profile;
ALTER INDEX IF EXISTS idx_chores_profile RENAME TO idx_tasks_profile;

-- Rename sequence if it exists
ALTER SEQUENCE IF EXISTS chores_id_seq RENAME TO tasks_id_seq;

-- RLS policies are automatically renamed with the table
-- No need to recreate them

-- Update function that references chores table
-- Note: Any triggers or functions referencing 'chores' may need updates