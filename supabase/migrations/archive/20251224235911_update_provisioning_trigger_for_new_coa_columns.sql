/*
  # Update Provisioning Trigger for New COA Columns

  ## Overview
  Updates the handle_new_user_profile() trigger function to use the new
  COA column names (class, account_type, display_name) and removes
  references to hierarchy columns (level, parent_account_number).

  ## Changes
  - Update INSERT INTO user_chart_of_accounts to use new column names
  - Remove level and parent_account_number columns
  - Map account_type → class
  - Map category → account_type
  - Map custom_display_name → display_name
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
  -- Try to create complete profile setup
  -- If anything fails, log it but don't prevent user creation
  BEGIN
    -- Get user metadata
    v_full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
    v_email := COALESCE(NEW.email, '');

    -- 1. Create user_profiles entry
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

    -- 2. Create default personal profile
    INSERT INTO profiles (user_id, profile_type, display_name)
    VALUES (NEW.id, 'personal', 'Personal')
    RETURNING id INTO new_profile_id;

    -- 3. Create owner membership
    INSERT INTO profile_memberships (profile_id, user_id, role)
    VALUES (new_profile_id, NEW.id, 'owner');

    -- 4. Auto-provision chart of accounts for the new profile
    -- UPDATED: Use new column names (class, account_type, display_name)
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
      true,
      false
    FROM chart_of_accounts_templates t
    ORDER BY t.sort_order;

    GET DIAGNOSTICS new_coa_count = ROW_COUNT;

    -- 5. Create default tab for the profile
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

    RAISE NOTICE 'Successfully provisioned user %: profile %, % chart accounts, tab %',
      NEW.id, new_profile_id, new_coa_count, new_tab_id;

  EXCEPTION
    WHEN OTHERS THEN
      -- Log the error but allow user creation to succeed
      RAISE WARNING 'Failed to provision user %: % (SQLSTATE: %)',
        NEW.id, SQLERRM, SQLSTATE;
      -- Don't re-raise - this allows the user creation to succeed
  END;

  -- Always return NEW to allow user creation
  RETURN NEW;
END;
$$;
