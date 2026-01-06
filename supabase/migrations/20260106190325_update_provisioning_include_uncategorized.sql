/*
  # Update Provisioning to Include Uncategorized Accounts

  ## Overview
  Updates the chart of accounts provisioning function to include the new uncategorized
  accounts (4999 and 9999) at signup, ensuring users always have fallback categories
  for transactions.

  ## Changes
  - Expand Income range to include 4999 (Uncategorized Income)
  - Expand Expense range to include 9999 (Uncategorized Expense)

  ## Security
  Function remains SECURITY DEFINER for system provisioning
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
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_user_id
  ORDER BY created_at ASC
  LIMIT 1;

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
    (t.account_number >= 4000 AND t.account_number <= 4999) OR
    (t.account_number >= 6000 AND t.account_number <= 9999)
  )
  AND NOT EXISTS (
    SELECT 1 FROM user_chart_of_accounts
    WHERE profile_id = v_profile_id AND template_account_number = t.account_number
  );
END;
$$;
