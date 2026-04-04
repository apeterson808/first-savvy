/*
  # Allow parents to submit task completions on behalf of children
  
  1. Changes
    - Add INSERT policy to allow parents to submit task completions for their children
    - This allows parents to demo/test the task completion flow when viewing child profiles
  
  2. Security
    - Policy checks that the user is the parent of the child profile
    - Child must be active
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'task_completions'
      AND policyname = 'Parents can submit task completions for children'
  ) THEN
    CREATE POLICY "Parents can submit task completions for children"
      ON task_completions
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM child_profiles cp
          JOIN profiles p ON p.id = cp.parent_profile_id
          WHERE cp.id = task_completions.child_profile_id
            AND p.user_id = auth.uid()
            AND cp.is_active = true
        )
      );
  END IF;
END $$;
