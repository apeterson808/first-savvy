/*
  # Fix Simulator - Ensure Uncategorized Accounts Exist

  ## Problem
  Transaction imports via simulator are failing because the auto-generated journal
  entries cannot find the uncategorized accounts (4999 and 9999).

  ## Root Cause Analysis
  1. Dec 30 migration loaded 79 accounts WITHOUT 4999/9999 (ended at 4260 and 9000)
  2. Jan 6 migrations ADDED 4999/9999 templates and updated provisioning
  3. However, the current state may have inconsistencies

  ## Solution
  This migration ensures:
  1. Templates for 4999 and 9999 exist (with proper configuration)
  2. All existing profiles have these accounts provisioned
  3. Provisioning function includes the full range

  ## Impact
  - Simulator will successfully import transactions
  - Journal entries will auto-create with uncategorized fallback
  - No more "Cannot create journal entry: Uncategorized account not found" errors
*/

-- ============================================================================
-- STEP 1: Ensure templates exist for uncategorized accounts
-- ============================================================================

-- Add Uncategorized Income (4999) if it doesn't exist
INSERT INTO chart_of_accounts_templates (
  account_number,
  class,
  account_type,
  account_detail,
  display_name,
  icon,
  color,
  sort_order,
  is_editable
) VALUES
  (4999, 'income', 'uncategorized', 'uncategorized', 'Uncategorized Income', 'HelpCircle', '#9ca3af', 999, false)
ON CONFLICT (account_number)
DO UPDATE SET
  class = EXCLUDED.class,
  account_type = EXCLUDED.account_type,
  account_detail = EXCLUDED.account_detail,
  display_name = EXCLUDED.display_name,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  is_editable = EXCLUDED.is_editable;

-- Add Uncategorized Expense (9999) if it doesn't exist
INSERT INTO chart_of_accounts_templates (
  account_number,
  class,
  account_type,
  account_detail,
  display_name,
  icon,
  color,
  sort_order,
  is_editable
) VALUES
  (9999, 'expense', 'uncategorized', 'uncategorized', 'Uncategorized Expense', 'HelpCircle', '#9ca3af', 9999, false)
ON CONFLICT (account_number)
DO UPDATE SET
  class = EXCLUDED.class,
  account_type = EXCLUDED.account_type,
  account_detail = EXCLUDED.account_detail,
  display_name = EXCLUDED.display_name,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  is_editable = EXCLUDED.is_editable;

-- ============================================================================
-- STEP 2: Provision uncategorized accounts for ALL existing profiles
-- ============================================================================

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
  p.id as profile_id,
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
WHERE t.account_number IN (4999, 9999)
  AND NOT EXISTS (
    SELECT 1 FROM user_chart_of_accounts uca
    WHERE uca.profile_id = p.id
      AND uca.template_account_number = t.account_number
  );

-- ============================================================================
-- STEP 3: Update provisioning function to include uncategorized accounts
-- ============================================================================

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
    WHERE profile_id = v_profile_id
      AND template_account_number = t.account_number
  );
END;
$$;

COMMENT ON FUNCTION provision_chart_of_accounts_for_user IS
'Provisions Income (4000-4999) and Expense (6000-9999) accounts for new users.
Includes uncategorized fallback accounts (4999, 9999) to ensure journal entries
can always be created for transactions without explicit categories.';

-- ============================================================================
-- VERIFICATION: Log counts for debugging
-- ============================================================================

DO $$
DECLARE
  v_template_count integer;
  v_user_account_count integer;
  v_profiles_count integer;
BEGIN
  SELECT COUNT(*) INTO v_template_count
  FROM chart_of_accounts_templates
  WHERE account_number IN (4999, 9999);

  SELECT COUNT(*) INTO v_user_account_count
  FROM user_chart_of_accounts
  WHERE template_account_number IN (4999, 9999);

  SELECT COUNT(*) INTO v_profiles_count
  FROM profiles;

  RAISE NOTICE 'Uncategorized account templates: % (expected: 2)', v_template_count;
  RAISE NOTICE 'User uncategorized accounts: % (expected: % x 2)',
    v_user_account_count, v_profiles_count;
  RAISE NOTICE 'Total profiles: %', v_profiles_count;

  IF v_template_count != 2 THEN
    RAISE WARNING 'Missing uncategorized templates! Found %, expected 2', v_template_count;
  END IF;

  IF v_user_account_count != (v_profiles_count * 2) THEN
    RAISE WARNING 'Some profiles missing uncategorized accounts! Found %, expected %',
      v_user_account_count, (v_profiles_count * 2);
  END IF;
END;
$$;