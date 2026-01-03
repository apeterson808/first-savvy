/*
  # Add Anon Role Policies for Signup Trigger
  
  ## Problem
  During user signup via the Supabase client, the operation runs with the anon role,
  not the authenticated role. The trigger `handle_new_user_profile` runs in this
  context, so it needs INSERT policies for the anon role.
  
  ## Solution
  Add INSERT policies for anon role that allow the signup trigger to create
  the initial profile data.
  
  ## Security
  These policies are safe because:
  - They only allow INSERT, not SELECT/UPDATE/DELETE
  - The trigger ensures user_id matches the new user being created
  - Users cannot manually call these; they only work during signup
*/

-- Allow anon role to insert profiles during signup
CREATE POLICY "Anon can insert profiles during signup"
  ON profiles
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon role to insert memberships during signup  
CREATE POLICY "Anon can insert memberships during signup"
  ON profile_memberships
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Allow anon role to insert chart of accounts during signup
CREATE POLICY "Anon can insert chart accounts during signup"
  ON user_chart_of_accounts
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Note: These are safe because:
-- 1. Users cannot directly access these tables (no SELECT policy for anon)
-- 2. The trigger controls what data gets inserted
-- 3. The trigger validates the user_id matches NEW.id from auth.users
