/*
  # Make Trigger Non-Blocking for User Creation
  
  ## Problem
  The trigger `handle_new_user_profile` is causing user signup to fail completely.
  When the trigger encounters an error, it rolls back the entire transaction,
  including the user creation in auth.users.
  
  ## Solution
  Modify the trigger to catch and log errors without preventing user creation.
  This ensures users can sign up even if profile provisioning temporarily fails.
  The application can retry profile creation later via ensure_default_profile.
  
  ## Changes
  - Wrap all trigger operations in an exception handler
  - Return NEW successfully even if profile creation fails
  - Log errors for debugging without blocking user creation
*/

-- Drop and recreate the trigger function with better error handling
DROP TRIGGER IF EXISTS on_auth_user_created_profile ON auth.users;
DROP FUNCTION IF EXISTS handle_new_user_profile();

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
  -- Try to create profile and related data
  -- If anything fails, log it but don't prevent user creation
  BEGIN
    -- Create a personal profile for the new user
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
    
    RAISE NOTICE 'Successfully created profile % with % chart accounts for user %', 
      new_profile_id, new_coa_count, NEW.id;

  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error but allow user creation to succeed
      RAISE WARNING 'Failed to create profile for user %: % (SQLSTATE: %)', 
        NEW.id, SQLERRM, SQLSTATE;
      -- Don't re-raise - this allows the user creation to succeed
  END;

  -- Always return NEW to allow user creation
  RETURN NEW;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION handle_new_user_profile() TO authenticated;
GRANT EXECUTE ON FUNCTION handle_new_user_profile() TO service_role;
GRANT EXECUTE ON FUNCTION handle_new_user_profile() TO anon;

-- Recreate the trigger
CREATE TRIGGER on_auth_user_created_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_profile();

COMMENT ON FUNCTION handle_new_user_profile() IS 
  'Attempts to auto-provision profile for new users. Logs errors without blocking signup.';
