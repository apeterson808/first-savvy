/*
  # Add INSERT Policy for Authenticated Users on Chart of Accounts

  1. Problem
    - Missing INSERT policy for authenticated users on user_chart_of_accounts table
    - Users get 403 Forbidden when trying to create custom categories
    - Only anon and service_role have INSERT policies

  2. Solution
    - Add INSERT policy for authenticated users
    - Allow users to insert chart accounts into profiles they have access to

  3. Security
    - Uses has_profile_access() function to verify profile ownership/membership
    - Ensures users can only create accounts in their own profiles
*/

-- Add INSERT policy for authenticated users
CREATE POLICY "Users can insert chart of accounts in their profiles"
  ON user_chart_of_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (has_profile_access(profile_id));
