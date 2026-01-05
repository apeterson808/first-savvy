/*
  # Fix Chart of Accounts Provisioning Function - Remove user_id

  ## Problem
  The `provision_chart_of_accounts_for_user()` function still references the user_id
  column which was removed from user_chart_of_accounts table in migration
  20260103221149.

  ## Solution
  Update the function to only use profile_id, removing all user_id references.

  ## Changes
  - Remove user_id from INSERT statement
  - Keep profile_id as the sole ownership identifier
  - Maintain all other functionality unchanged
*/

CREATE OR REPLACE FUNCTION provision_chart_of_accounts_for_user(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
BEGIN
  -- Get the user's profile
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_user_id
  ORDER BY created_at ASC
  LIMIT 1;

  -- Provision only Income (4000-4260) and Expense (6000-9000) accounts as ACTIVE
  INSERT INTO user_chart_of_accounts (
    profile_id,
    template_account_number,
    account_number,
    display_name,
    class,
    account_detail,
    account_type,
    icon,
    color,
    is_active,
    is_user_created
  )
  SELECT
    v_profile_id,
    t.account_number,
    t.account_number,
    t.display_name,
    t.class,
    t.account_detail,
    t.account_type,
    t.icon,
    t.color,
    true,
    false
  FROM chart_of_accounts_templates t
  WHERE (
    (t.account_number >= 4000 AND t.account_number <= 4260) OR
    (t.account_number >= 6000 AND t.account_number <= 9000)
  )
  AND NOT EXISTS (
    SELECT 1 FROM user_chart_of_accounts
    WHERE profile_id = v_profile_id AND template_account_number = t.account_number
  );
END;
$$;