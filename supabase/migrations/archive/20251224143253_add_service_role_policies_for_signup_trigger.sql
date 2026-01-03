/*
  # Add Service Role Policies for Signup Trigger
  
  ## Problem
  The trigger function `handle_new_user_profile` runs as SECURITY DEFINER, but RLS
  policies still apply. During signup, auth.uid() may not be properly set yet, causing
  the INSERT operations to fail.
  
  ## Solution
  Add explicit INSERT policies for service_role to allow the trigger to bypass RLS
  when creating initial profile data.
  
  ## Changes
  - Add service_role INSERT policies for profiles, profile_memberships, and user_chart_of_accounts
  - These policies allow unrestricted INSERT for service_role only
*/

-- Add service_role INSERT policy for profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Service role can insert profiles'
  ) THEN
    CREATE POLICY "Service role can insert profiles"
      ON profiles
      FOR INSERT
      TO service_role
      WITH CHECK (true);
  END IF;
END $$;

-- Add service_role INSERT policy for profile_memberships
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profile_memberships' 
    AND policyname = 'Service role can insert memberships'
  ) THEN
    CREATE POLICY "Service role can insert memberships"
      ON profile_memberships
      FOR INSERT
      TO service_role
      WITH CHECK (true);
  END IF;
END $$;

-- Add service_role INSERT policy for user_chart_of_accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'user_chart_of_accounts' 
    AND policyname = 'Service role can insert chart accounts'
  ) THEN
    CREATE POLICY "Service role can insert chart accounts"
      ON user_chart_of_accounts
      FOR INSERT
      TO service_role
      WITH CHECK (true);
  END IF;
END $$;

-- Grant necessary permissions to the trigger function
GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
