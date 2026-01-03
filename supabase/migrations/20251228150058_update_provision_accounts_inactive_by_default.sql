/*
  # Update Chart of Accounts Provisioning to Inactive by Default

  ## Changes
  - Modify provision_chart_of_accounts_for_user function to provision ALL accounts as inactive by default
  - Accounts will only become active when:
    - Income/Expense: Added to budget or used in transactions
    - Asset/Liability/Equity: Linked through API or manually created with data

  ## Migration Details
  Updates the provisioning function to set is_active = false for all newly provisioned accounts.
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
  -- Get the user's default profile
  SELECT id INTO v_profile_id
  FROM profiles
  WHERE user_id = p_user_id
  ORDER BY created_at ASC
  LIMIT 1;

  -- Copy all template accounts to user's chart of accounts
  -- ALL accounts start as inactive by default
  INSERT INTO user_chart_of_accounts (
    user_id,
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
    p_user_id,
    v_profile_id,
    t.account_number,
    t.account_number,
    t.display_name,
    t.class,
    t.account_detail,
    t.account_type,
    t.icon,
    t.color,
    false,  -- ALL accounts start inactive
    false
  FROM chart_of_accounts_templates t
  WHERE NOT EXISTS (
    SELECT 1 FROM user_chart_of_accounts
    WHERE user_id = p_user_id AND template_account_number = t.account_number
  );
END;
$$;
