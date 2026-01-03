/*
  # Update Provisioning for Two-Tier System
  
  ## Overview
  Updates the chart of accounts provisioning to implement a two-tier system:
  - Income accounts (4000-4260): Auto-provisioned as ACTIVE for immediate budgeting
  - Expense accounts (6000-9000): Auto-provisioned as ACTIVE for immediate budgeting
  - Asset/Liability/Equity accounts (1000-3200): Auto-provisioned as INACTIVE (on-demand)
  
  ## Rationale
  This gives new users immediate access to budget categories without overwhelming them
  with unused asset/liability accounts. Users can add specific accounts (like "Chase Checking")
  only when they need them.
  
  ## Changes
  Updates the provision_chart_of_accounts_for_user function to conditionally set is_active
  based on account number ranges.
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
  -- Income (4000-4260) and Expense (6000-9000) start as ACTIVE for budgeting
  -- Asset/Liability/Equity (1000-3200) start as INACTIVE (on-demand)
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
    CASE
      -- Income accounts (4000-4260): ACTIVE for budgeting
      WHEN t.account_number >= 4000 AND t.account_number <= 4260 THEN true
      -- Expense accounts (6000-9000): ACTIVE for budgeting
      WHEN t.account_number >= 6000 AND t.account_number <= 9000 THEN true
      -- Asset/Liability/Equity accounts (1000-3200): INACTIVE (on-demand)
      ELSE false
    END as is_active,
    false
  FROM chart_of_accounts_templates t
  WHERE NOT EXISTS (
    SELECT 1 FROM user_chart_of_accounts
    WHERE user_id = p_user_id AND template_account_number = t.account_number
  );
END;
$$;
