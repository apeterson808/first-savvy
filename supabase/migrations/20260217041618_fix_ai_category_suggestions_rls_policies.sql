/*
  # Fix AI Category Suggestions RLS Policies

  1. Changes
    - Drop incorrect RLS policies that use auth.uid() = profile_id
    - Create correct policies using has_profile_access(profile_id) function
  
  2. Security
    - SELECT policy: Users can read suggestions for profiles they have access to
    - INSERT policy: Users can insert suggestions for profiles they have access to
    - UPDATE policy: Users can update suggestions for profiles they have access to
    - DELETE policy: Users can delete suggestions for profiles they have access to
*/

-- Drop old policies
DROP POLICY IF EXISTS "Users can read own AI category suggestions" ON ai_category_suggestions;
DROP POLICY IF EXISTS "Users can insert own AI category suggestions" ON ai_category_suggestions;
DROP POLICY IF EXISTS "Users can update own AI category suggestions" ON ai_category_suggestions;
DROP POLICY IF EXISTS "Users can delete own AI category suggestions" ON ai_category_suggestions;

-- Create correct policies using has_profile_access function
CREATE POLICY "Users can read AI category suggestions in their profiles"
  ON ai_category_suggestions
  FOR SELECT
  TO authenticated
  USING (has_profile_access(profile_id));

CREATE POLICY "Users can insert AI category suggestions in their profiles"
  ON ai_category_suggestions
  FOR INSERT
  TO authenticated
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can update AI category suggestions in their profiles"
  ON ai_category_suggestions
  FOR UPDATE
  TO authenticated
  USING (has_profile_access(profile_id))
  WITH CHECK (has_profile_access(profile_id));

CREATE POLICY "Users can delete AI category suggestions in their profiles"
  ON ai_category_suggestions
  FOR DELETE
  TO authenticated
  USING (has_profile_access(profile_id));
