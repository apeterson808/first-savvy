/*
  # Update Provisioning to Income/Expense Only

  ## Overview
  Updates the chart of accounts provisioning to only create Income and Expense accounts
  at signup. Asset/Liability/Equity accounts will be created on-demand when users need them.

  ## Rationale
  - New users only need budget categories (Income/Expense) immediately
  - Prevents overwhelming users with 89 empty accounts
  - Asset/Liability/Equity accounts created through wizard when needed
  - Cleaner dropdowns and better UX

  ## Changes
  - Income accounts (4000-4260): Auto-provisioned as ACTIVE for budgeting
  - Expense accounts (6000-9000): Auto-provisioned as ACTIVE for budgeting
  - Asset/Liability/Equity accounts (1000-3200): NOT provisioned at signup

  ## Security
  Function is SECURITY DEFINER to allow system provisioning
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
    true,
    false
  FROM chart_of_accounts_templates t
  WHERE (
    (t.account_number >= 4000 AND t.account_number <= 4260) OR
    (t.account_number >= 6000 AND t.account_number <= 9000)
  )
  AND NOT EXISTS (
    SELECT 1 FROM user_chart_of_accounts
    WHERE user_id = p_user_id AND template_account_number = t.account_number
  );
END;
$$;