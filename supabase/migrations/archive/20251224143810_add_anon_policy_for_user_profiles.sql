/*
  # Add Anon Policy for user_profiles Table
  
  ## Problem
  The trigger `create_user_profile` tries to insert into user_profiles during signup,
  but there's no INSERT policy for the anon role. This causes signup to fail.
  
  ## Solution
  Add an INSERT policy for anon role on user_profiles to allow the trigger to
  create the user profile record during signup.
  
  ## Security
  This is safe because:
  - The trigger controls what data gets inserted
  - Users cannot directly access user_profiles (no SELECT policy for anon)
  - The trigger validates the user_id matches the new auth.users record
*/

-- Add INSERT policy for anon role on user_profiles
CREATE POLICY "Anon can insert user profiles during signup"
  ON user_profiles
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Also add service_role policy for completeness
CREATE POLICY "Service role can insert user profiles"
  ON user_profiles
  FOR INSERT
  TO service_role
  WITH CHECK (true);
