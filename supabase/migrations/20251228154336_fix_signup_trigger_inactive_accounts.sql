/*
  # Fix Signup Trigger to Provision Accounts as Inactive

  ## Overview
  Updates the handle_new_user_profile() trigger to provision all accounts
  as inactive by default, matching the behavior of the manual provisioning function.

  ## Changes
  - Change is_active from true to false in the INSERT statement
  - Ensures consistency between automatic and manual provisioning

  ## Why
  Accounts should only be active when actually used (linked, budgeted, or transacted).
  The Dec 28 migration updated the manual provision function but missed the trigger.
*/

CREATE OR REPLACE FUNCTION handle_new_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  new_profile_id uuid;
  new_tab_id uuid;
  new_coa_count int;
  v_full_name text;
  v_email text;
BEGIN
  BEGIN
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
    v_email := COALESCE(NEW.email, '');

    INSERT INTO user_profiles (id, email, full_name)
    VALUES (NEW.id, v_email, v_full_name)
    ON CONFLICT (id) DO UPDATE
    SET
      email = EXCLUDED.email,
      full_name = CASE
        WHEN COALESCE(EXCLUDED.full_name, '') != ''
        THEN EXCLUDED.full_name
        ELSE user_profiles.full_name
      END;

    INSERT INTO profiles (user_id, profile_type, display_name)
    VALUES (NEW.id, 'personal', 'Personal')
    RETURNING id INTO new_profile_id;

    INSERT INTO profile_memberships (profile_id, user_id, role)
    VALUES (new_profile_id, NEW.id, 'owner');

    INSERT INTO user_chart_of_accounts (
      user_id,
      profile_id,
      template_account_number,
      account_number,
      class,
      account_type,
      account_detail,
      display_name,
      icon,
      color,
      is_active,
      is_user_created
    )
    SELECT
      NEW.id,
      new_profile_id,
      t.account_number,
      t.account_number,
      t.class,
      t.account_type,
      t.account_detail,
      t.display_name,
      t.icon,
      t.color,
      false,  -- Changed from true to false - accounts start inactive
      false
    FROM chart_of_accounts_templates t
    ORDER BY t.sort_order;

    GET DIAGNOSTICS new_coa_count = ROW_COUNT;

    INSERT INTO profile_tabs (
      owner_user_id,
      profile_user_id,
      profile_type,
      profile_name,
      tab_order,
      is_active,
      last_accessed_at
    )
    VALUES (
      NEW.id,
      NEW.id,
      'personal',
      'Personal',
      0,
      true,
      now()
    )
    RETURNING id INTO new_tab_id;

    RAISE NOTICE 'Successfully provisioned user %: profile %, % chart accounts (inactive), tab %',
      NEW.id, new_profile_id, new_coa_count, new_tab_id;

  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to provision user %: % (SQLSTATE: %)',
        NEW.id, SQLERRM, SQLSTATE;
  END;

  RETURN NEW;
END;
$$;
