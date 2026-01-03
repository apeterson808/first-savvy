/*
  # Disable RLS During Trigger Execution
  
  ## Problem
  During user signup, the trigger `handle_new_user_profile` tries to insert into
  profiles, profile_memberships, and user_chart_of_accounts. However, RLS policies
  check auth.uid(), which is not set during the trigger execution because the user
  is still being created.
  
  ## Solution
  Modify the trigger function to explicitly disable RLS for its inserts using
  a SECURITY DEFINER function that bypasses RLS entirely.
  
  ## Changes
  - Drop and recreate the trigger function with explicit RLS bypass
  - Use direct SQL inserts that don't check RLS during signup
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user_profile();

-- Create a new version that explicitly handles RLS
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  new_profile_id uuid;
  new_coa_count int;
BEGIN
  -- Disable RLS for this function's operations
  -- Since this runs as SECURITY DEFINER with postgres owner, it can bypass RLS
  
  -- Create a personal profile for the new user
  -- Use explicit INSERT that doesn't depend on auth.uid() being set
  INSERT INTO profiles (user_id, profile_type, display_name)
  VALUES (NEW.id, 'personal', 'Personal')
  RETURNING id INTO new_profile_id;

  -- Create owner membership
  INSERT INTO profile_memberships (profile_id, user_id, role)
  VALUES (new_profile_id, NEW.id, 'owner');

  -- Auto-provision chart of accounts for the new profile
  INSERT INTO user_chart_of_accounts (
    user_id,
    profile_id,
    template_account_number,
    account_number,
    account_type,
    account_detail,
    category,
    icon,
    color,
    is_active,
    is_user_created,
    level,
    parent_account_number
  )
  SELECT 
    NEW.id,
    new_profile_id,
    t.account_number,
    t.account_number,
    t.account_type,
    t.account_detail,
    t.category,
    t.icon,
    t.color,
    true,
    false,
    t.level,
    t.parent_account_number
  FROM chart_of_accounts_templates t
  ORDER BY t.account_number;

  GET DIAGNOSTICS new_coa_count = ROW_COUNT;
  
  -- Log success
  RAISE NOTICE 'Created profile % with % chart of accounts for user %', 
    new_profile_id, new_coa_count, NEW.id;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log the error but don't prevent user creation
    RAISE WARNING 'Error in handle_new_user_profile: %', SQLERRM;
    -- Re-raise to prevent user creation if profile setup fails
    RAISE;
END;
$$;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_profile();

-- Update the INSERT policies to allow inserts when user_id matches the inserting user
-- This handles the case where auth.uid() might be NULL during trigger execution

DROP POLICY IF EXISTS "System can create profiles during signup" ON profiles;
CREATE POLICY "System can create profiles during signup"
  ON profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid() OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Profile owners can insert memberships" ON profile_memberships;
CREATE POLICY "Profile owners can insert memberships"
  ON profile_memberships
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles 
      WHERE id = profile_memberships.profile_id 
        AND user_id = auth.uid()
    )
    OR auth.uid() IS NULL
  );

DROP POLICY IF EXISTS "Users can insert chart of accounts in their profiles" ON user_chart_of_accounts;
CREATE POLICY "Users can insert chart of accounts in their profiles"
  ON user_chart_of_accounts
  FOR INSERT
  TO authenticated
  WITH CHECK (has_profile_access(profile_id) OR auth.uid() IS NULL);
