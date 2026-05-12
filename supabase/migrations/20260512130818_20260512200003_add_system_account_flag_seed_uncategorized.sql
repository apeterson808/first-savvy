/*
  # Add is_system_account flag and seed Uncategorized Transactions account

  ## Changes
  - Adds is_system_account boolean column to user_chart_of_accounts (default false)
  - Adds is_system_account to chart_of_accounts_templates (default false)
  - Seeds "Uncategorized Transactions" system account for all existing profiles
  - Updates manual_provision_current_user() to seed the system account on new profile creation
  - Updates create_virtual_profile() if it exists to do the same

  ## Purpose
  The Uncategorized Transactions account acts as a QBO-style suspense account.
  When a transaction is imported without a category, the JE offset line uses this account.
  Once the user assigns a real category, the suspense line is replaced.

  ## Account Details
  - Account number: 9999 (system reserved)
  - Class: expense
  - Account type: uncategorized
  - is_system_account: true
  - is_active: true (visible in COA for now)
*/

-- Add is_system_account to user_chart_of_accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_chart_of_accounts' AND column_name = 'is_system_account'
  ) THEN
    ALTER TABLE user_chart_of_accounts ADD COLUMN is_system_account boolean DEFAULT false;
  END IF;
END $$;

-- Add is_system_account to chart_of_accounts_templates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chart_of_accounts_templates' AND column_name = 'is_system_account'
  ) THEN
    ALTER TABLE chart_of_accounts_templates ADD COLUMN is_system_account boolean DEFAULT false;
  END IF;
END $$;

-- Seed Uncategorized Transactions account for all existing profiles that don't have one
INSERT INTO user_chart_of_accounts (
  profile_id,
  account_number,
  template_account_number,
  account_type,
  account_detail,
  display_name,
  class,
  current_balance,
  is_active,
  is_user_created,
  is_system_account,
  icon,
  color
)
SELECT
  p.id,
  9999,
  9999,
  'uncategorized',
  'uncategorized',
  'Uncategorized Transactions',
  'expense',
  0,
  true,
  false,
  true,
  'HelpCircle',
  '#94a3b8'
FROM profiles p
WHERE NOT EXISTS (
  SELECT 1 FROM user_chart_of_accounts uca
  WHERE uca.profile_id = p.id AND uca.account_number = 9999
);

-- Update manual_provision_current_user to also seed the system account
CREATE OR REPLACE FUNCTION manual_provision_current_user()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
  v_display_name text;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT p.id INTO v_profile_id
  FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = v_user_id
  LIMIT 1;

  IF v_profile_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', true, 'message', 'Profile already exists', 'profile_id', v_profile_id);
  END IF;

  SELECT COALESCE(raw_user_meta_data->>'full_name', email)
  INTO v_display_name
  FROM auth.users
  WHERE id = v_user_id;

  INSERT INTO profiles (user_id, profile_type, display_name, is_deleted)
  VALUES (v_user_id, 'personal', COALESCE(v_display_name, 'My Profile'), false)
  RETURNING id INTO v_profile_id;

  INSERT INTO profile_memberships (user_id, profile_id, role)
  VALUES (v_user_id, v_profile_id, 'owner');

  INSERT INTO profile_tabs (owner_user_id, profile_id, display_name, is_active)
  VALUES (v_user_id, v_profile_id, COALESCE(v_display_name, 'My Profile'), true);

  -- Create chart of accounts from templates
  INSERT INTO user_chart_of_accounts (
    profile_id,
    account_number,
    template_account_number,
    account_type,
    account_detail,
    display_name,
    class,
    current_balance,
    is_active,
    is_user_created,
    icon,
    color,
    parent_account_id
  )
  SELECT
    v_profile_id,
    account_number,
    account_number,
    account_type,
    account_detail,
    display_name,
    class,
    0,
    false,
    false,
    icon,
    color,
    NULL
  FROM chart_of_accounts_templates
  ORDER BY account_number;

  -- Seed Uncategorized Transactions system account
  INSERT INTO user_chart_of_accounts (
    profile_id, account_number, template_account_number, account_type, account_detail,
    display_name, class, current_balance, is_active, is_user_created, is_system_account, icon, color
  ) VALUES (
    v_profile_id, 9999, 9999, 'uncategorized', 'uncategorized',
    'Uncategorized Transactions', 'expense', 0, true, false, true, 'HelpCircle', '#94a3b8'
  )
  ON CONFLICT DO NOTHING;

  RETURN jsonb_build_object(
    'success', true, 
    'message', 'Profile created successfully with chart of accounts',
    'profile_id', v_profile_id
  );
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;
