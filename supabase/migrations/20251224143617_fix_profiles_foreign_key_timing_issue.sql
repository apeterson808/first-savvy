/*
  # Fix Profiles Foreign Key Timing Issue
  
  ## Problem
  The trigger `handle_new_user_profile` runs AFTER INSERT on auth.users, but the
  foreign key constraint `profiles_user_id_fkey` is checked immediately, causing
  a violation because the user hasn't been fully committed to auth.users yet.
  
  ## Solution
  Make the foreign key constraint DEFERRABLE INITIALLY DEFERRED, so it's checked
  at the end of the transaction rather than immediately. This allows the trigger
  to insert the profile before the constraint is validated.
  
  ## Changes
  - Drop and recreate the foreign key constraint as DEFERRABLE INITIALLY DEFERRED
*/

-- Drop the existing foreign key constraint
ALTER TABLE profiles 
DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;

-- Recreate it as DEFERRABLE INITIALLY DEFERRED
ALTER TABLE profiles
ADD CONSTRAINT profiles_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES auth.users(id) 
ON DELETE CASCADE
DEFERRABLE INITIALLY DEFERRED;

-- Also update profile_memberships to be deferrable
ALTER TABLE profile_memberships
DROP CONSTRAINT IF EXISTS profile_memberships_user_id_fkey;

ALTER TABLE profile_memberships
ADD CONSTRAINT profile_memberships_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE
DEFERRABLE INITIALLY DEFERRED;

-- Also update user_chart_of_accounts to be deferrable
ALTER TABLE user_chart_of_accounts
DROP CONSTRAINT IF EXISTS user_chart_of_accounts_user_id_fkey;

ALTER TABLE user_chart_of_accounts
ADD CONSTRAINT user_chart_of_accounts_user_id_fkey
FOREIGN KEY (user_id)
REFERENCES auth.users(id)
ON DELETE CASCADE
DEFERRABLE INITIALLY DEFERRED;

COMMENT ON CONSTRAINT profiles_user_id_fkey ON profiles IS
  'Deferred foreign key to allow trigger to insert profile during user creation';
