/*
  # Allow Service Role to Delete System Accounts

  1. Purpose
    - Allow the reset function (running as service role) to delete system accounts
    - Still protect system accounts from regular user deletion
    - Enable full data reset including system accounts

  2. Changes
    - Modify trigger functions to check if operation is by service role
    - Service role can delete/update system accounts (for reset functionality)
    - Regular users still cannot modify system accounts

  3. Security
    - Only service role (used by reset function) can bypass protection
    - Regular authenticated users still blocked from modifying system accounts
*/

-- Function to prevent updates to system accounts (allows service role)
CREATE OR REPLACE FUNCTION prevent_system_account_updates()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow service role to update system accounts (for reset functionality)
  IF current_setting('role') = 'service_role' THEN
    RETURN NEW;
  END IF;
  
  -- Block regular users from updating system accounts
  IF OLD.template_account_number IN (3000, 3200) THEN
    RAISE EXCEPTION 'System accounts (3000, 3200) cannot be modified';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to prevent deletion of system accounts (allows service role)
CREATE OR REPLACE FUNCTION prevent_system_account_deletes()
RETURNS TRIGGER AS $$
BEGIN
  -- Allow service role to delete system accounts (for reset functionality)
  IF current_setting('role') = 'service_role' THEN
    RETURN OLD;
  END IF;
  
  -- Block regular users from deleting system accounts
  IF OLD.template_account_number IN (3000, 3200) THEN
    RAISE EXCEPTION 'System accounts (3000, 3200) cannot be deleted';
  END IF;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;