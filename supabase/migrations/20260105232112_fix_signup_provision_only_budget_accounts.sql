/*
  # Fix Signup to Provision Only Budget Accounts (Income/Expense)

  ## Overview
  Updates the new user signup trigger to provision only the 38 active budget accounts
  (8 Income + 30 Expense) instead of all 79 accounts as inactive.

  ## Problem
  - Current signup trigger provisions ALL 79 accounts as inactive
  - Reset function provisions only 38 active budget accounts (Income/Expense)
  - New users and reset users have different starting states (79 vs 38 accounts)
  - Inconsistent user experience between signup and reset flows

  ## Solution
  - Replace inline account provisioning in signup trigger with call to `provision_chart_of_accounts_for_user()`
  - This function already correctly provisions only Income (4000-4260) and Expense (6000-9000) as ACTIVE
  - Both new signups and resets will now create identical account sets

  ## Changes
  1. Drop existing `handle_new_user_profile()` function
  2. Recreate with simplified logic that calls `provision_chart_of_accounts_for_user()`
  3. Maintain all other functionality (profile, membership, tabs creation)

  ## Result
  - New users: 38 active budget accounts ready for immediate use
  - Reset users: 38 active budget accounts (no change)
  - Consistent experience across all flows
  - Asset/Liability/Equity accounts created on-demand via wizards

  ## Security
  Function remains SECURITY DEFINER to allow system provisioning during signup
*/

-- Drop the existing trigger function
DROP FUNCTION IF EXISTS handle_new_user_profile() CASCADE;

-- Recreate with simplified logic that calls the provisioning function
CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  new_profile_id uuid;
  new_tab_id uuid;
BEGIN
  BEGIN
    -- 1. Create or update user profile in user_profiles table
    INSERT INTO user_profiles (id, email, full_name)
    VALUES (
      NEW.id,
      COALESCE(NEW.email, ''),
      COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    )
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      full_name = CASE
        WHEN COALESCE(EXCLUDED.full_name, '') != ''
        THEN EXCLUDED.full_name
        ELSE user_profiles.full_name
      END;

    -- 2. Create default personal profile
    INSERT INTO profiles (user_id, profile_type, display_name)
    VALUES (NEW.id, 'personal', 'Personal')
    RETURNING id INTO new_profile_id;

    -- 3. Create profile membership
    INSERT INTO profile_memberships (profile_id, user_id, role)
    VALUES (new_profile_id, NEW.id, 'owner');

    -- 4. Provision chart of accounts using the standard function
    -- This creates only Income/Expense accounts (38 total) as ACTIVE
    PERFORM provision_chart_of_accounts_for_user(NEW.id);

    -- 5. Create profile tab
    INSERT INTO profile_tabs (
      owner_user_id,
      profile_user_id,
      profile_type,
      profile_name,
      tab_order,
      is_active,
      last_accessed_at
    )
    VALUES (
      NEW.id,
      NEW.id,
      'personal',
      'Personal',
      0,
      true,
      now()
    )
    RETURNING id INTO new_tab_id;

    RAISE NOTICE 'Successfully provisioned user %: profile %, 38 active budget accounts, tab %',
      NEW.id, new_profile_id, new_tab_id;

  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to provision user %: % (SQLSTATE: %)',
        NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user_profile();