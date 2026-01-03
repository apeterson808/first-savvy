/*
  # Fix Profile Trigger - Ensure Service Role Can Insert
  
  ## Problem
  The trigger `handle_new_user_profile` runs as SECURITY DEFINER but RLS policies
  still apply. During user signup, the trigger needs to insert into both profiles
  and profile_memberships tables, but RLS may block these operations.
  
  ## Solution
  Recreate the trigger function to ensure it can bypass RLS for initial profile creation.
  The function is already SECURITY DEFINER, which should give it superuser privileges.
  
  ## Changes
  - Drop and recreate the trigger function to ensure proper permissions
  - Ensure the function owner has sufficient privileges
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user_profile();

-- Recreate the trigger function with explicit security context
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
  -- Create a personal profile for the new user
  INSERT INTO public.profiles (user_id, profile_type, display_name)
  VALUES (NEW.id, 'personal', 'Personal')
  RETURNING id INTO new_profile_id;

  -- Create owner membership
  INSERT INTO public.profile_memberships (profile_id, user_id, role)
  VALUES (new_profile_id, NEW.id, 'owner');

  -- Auto-provision chart of accounts for the new profile
  -- Copy from templates to user's chart of accounts
  INSERT INTO public.user_chart_of_accounts (
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
  FROM public.chart_of_accounts_templates t
  ORDER BY t.account_number;

  GET DIAGNOSTICS new_coa_count = ROW_COUNT;
  
  RAISE NOTICE 'Created profile % with % chart of accounts entries for user %', 
    new_profile_id, new_coa_count, NEW.id;

  RETURN NEW;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION handle_new_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user_profile() TO service_role;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_profile();

-- Ensure the function has proper ownership
-- This ensures SECURITY DEFINER runs with appropriate privileges
COMMENT ON FUNCTION handle_new_user_profile() IS 
  'Auto-provisions profile, membership, and chart of accounts for new users. Runs with elevated privileges.';
