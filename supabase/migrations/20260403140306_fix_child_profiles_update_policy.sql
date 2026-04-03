/*
  # Fix Child Profiles UPDATE Policy

  1. Changes
    - Drop and recreate the UPDATE policy on child_profiles
    - Remove the WITH CHECK clause that was blocking legitimate parent updates
    - Simplify to only check parent_profile_id ownership
  
  2. Security
    - Parents can update their children's profiles
    - Children cannot update their own profiles (parent controls authentication settings)
*/

-- Drop the existing UPDATE policy
DROP POLICY IF EXISTS "Users can update their child profiles" ON child_profiles;

-- Create a simpler UPDATE policy without WITH CHECK blocking parent updates
CREATE POLICY "Parents can update their child profiles"
  ON child_profiles
  FOR UPDATE
  TO authenticated
  USING (
    parent_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );
