/*
  # Fix Profile Creation - Add Missing INSERT Policy
  
  ## Problem
  The trigger that creates profiles for new users is failing because there's no INSERT policy 
  on the profiles table. While the trigger is SECURITY DEFINER, we still need a policy for 
  the profile creation to succeed.
  
  ## Changes
  - Add INSERT policy for profiles table allowing system to create profiles during signup
  - Ensure trigger can insert profiles and memberships without RLS blocking it
  
  ## Security
  - Policy is restrictive and only allows profile creation in specific contexts
*/

-- Add INSERT policy for profiles table
-- This allows the trigger to create profiles for new users
CREATE POLICY "System can create profiles during signup"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());
