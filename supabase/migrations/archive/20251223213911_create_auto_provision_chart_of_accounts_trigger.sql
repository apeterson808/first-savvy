/*
  # Create Auto-Provisioning Trigger for Chart of Accounts

  ## Overview
  Creates a trigger that automatically provisions the chart of accounts templates
  for new users when they sign up or when a user_profile is created.

  ## Trigger Function
  - auto_provision_chart_of_accounts() - Triggers on user_profiles INSERT

  ## Security
  - Function is SECURITY DEFINER to allow inserting into user_chart_of_accounts
  - Only triggers on new user profile creation
*/

-- Create trigger function to auto-provision chart of accounts
CREATE OR REPLACE FUNCTION auto_provision_chart_of_accounts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Provision the chart of accounts for the new user
  PERFORM provision_chart_of_accounts_for_user(NEW.id);
  
  RETURN NEW;
END;
$$;

-- Create trigger on user_profiles table
DROP TRIGGER IF EXISTS trigger_auto_provision_chart_of_accounts ON user_profiles;

CREATE TRIGGER trigger_auto_provision_chart_of_accounts
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION auto_provision_chart_of_accounts();

-- Provision chart of accounts for all existing users who don't have it yet
DO $$
DECLARE
  v_user_record RECORD;
BEGIN
  FOR v_user_record IN
    SELECT id FROM user_profiles
    WHERE NOT EXISTS (
      SELECT 1 FROM user_chart_of_accounts
      WHERE user_id = user_profiles.id
    )
  LOOP
    PERFORM provision_chart_of_accounts_for_user(v_user_record.id);
  END LOOP;
END $$;