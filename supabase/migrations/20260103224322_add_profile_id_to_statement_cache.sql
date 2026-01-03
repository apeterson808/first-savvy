/*
  # Add profile_id to statement_cache table

  1. Changes
    - Add `profile_id` column to `statement_cache` table
    - Add foreign key constraint to `profiles` table
    - Add index on profile_id for query performance
    - Update RLS policies to filter by profile_id

  2. Notes
    - Column is nullable to support existing cached statements (simulation mode)
    - Existing statements without profile_id are accessible to all authenticated users
    - New statements should include profile_id when associated with a specific profile
*/

-- Add profile_id column to statement_cache
ALTER TABLE statement_cache 
ADD COLUMN IF NOT EXISTS profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_statement_cache_profile_id 
ON statement_cache(profile_id);

-- Drop existing RLS policies if they exist
DROP POLICY IF EXISTS "Users can view their cached statements" ON statement_cache;
DROP POLICY IF EXISTS "Users can insert their cached statements" ON statement_cache;
DROP POLICY IF EXISTS "Users can delete their cached statements" ON statement_cache;

-- Create new RLS policies that check profile membership
CREATE POLICY "Users can view cached statements for their profiles"
  ON statement_cache
  FOR SELECT
  TO authenticated
  USING (
    profile_id IS NULL 
    OR 
    EXISTS (
      SELECT 1 FROM profile_memberships pm
      WHERE pm.profile_id = statement_cache.profile_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert cached statements for their profiles"
  ON statement_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IS NULL
    OR
    EXISTS (
      SELECT 1 FROM profile_memberships pm
      WHERE pm.profile_id = statement_cache.profile_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete cached statements for their profiles"
  ON statement_cache
  FOR DELETE
  TO authenticated
  USING (
    profile_id IS NULL
    OR
    EXISTS (
      SELECT 1 FROM profile_memberships pm
      WHERE pm.profile_id = statement_cache.profile_id
      AND pm.user_id = auth.uid()
    )
  );
