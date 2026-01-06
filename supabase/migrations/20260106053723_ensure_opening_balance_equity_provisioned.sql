/*
  # Ensure Opening Balance Equity Account is Always Provisioned

  ## Problem
  The Opening Balance Equity account (3000) is required for creating opening balance
  journal entries, but the current provisioning function only creates Income and Expense
  accounts. This causes failures when users try to import statements with opening balances.

  ## Solution
  1. Update the provisioning function to include account 3000 (Opening Balance Equity)
  2. Provision it for any existing profiles that don't have it yet
  3. Mark it as active so it can be used immediately

  ## Changes
  - Update provision_chart_of_accounts_for_user() to include equity account 3000
  - Backfill for existing profiles
*/

-- Update the provisioning function to include Opening Balance Equity (3000)
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

  -- Provision Opening Balance Equity (3000) and Income/Expense accounts as ACTIVE
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
    t.account_number = 3000 OR
    (t.account_number >= 4000 AND t.account_number <= 4260) OR
    (t.account_number >= 6000 AND t.account_number <= 9000)
  )
  AND NOT EXISTS (
    SELECT 1 FROM user_chart_of_accounts
    WHERE profile_id = v_profile_id AND template_account_number = t.account_number
  );
END;
$$;

-- Provision Opening Balance Equity for all existing profiles that don't have it
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
  p.id,
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
FROM profiles p
CROSS JOIN chart_of_accounts_templates t
WHERE t.account_number = 3000
AND NOT EXISTS (
  SELECT 1 FROM user_chart_of_accounts
  WHERE profile_id = p.id AND template_account_number = 3000
);