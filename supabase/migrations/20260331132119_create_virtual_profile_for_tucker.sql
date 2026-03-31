/*
  # Create Virtual Profile for Tucker

  ## Overview
  This migration creates a separate virtual profile for Tucker (and any other child profiles
  that don't have owned_by_profile_id set), giving each child their own complete chart of accounts.

  ## Changes
  1. Makes profiles.user_id nullable to support virtual profiles
  2. Creates virtual profiles for all child_profiles without owned_by_profile_id
  3. Populates each virtual profile with the default chart of accounts from templates
  4. Updates child_profiles to reference their new virtual profiles

  ## Benefits
  - Each child has completely separate accounts/data
  - Virtual children work exactly like new users
  - Clean separation between parent and child financial data
*/

-- Make user_id nullable to support virtual profiles
ALTER TABLE profiles ALTER COLUMN user_id DROP NOT NULL;

-- Create virtual profiles and chart of accounts for children without owned_by_profile_id
DO $$
DECLARE
  child_record RECORD;
  new_profile_id uuid;
BEGIN
  FOR child_record IN 
    SELECT id, child_name, parent_profile_id 
    FROM child_profiles 
    WHERE owned_by_profile_id IS NULL AND is_active = true
  LOOP
    -- Create a new virtual profile for this child
    INSERT INTO profiles (user_id, profile_type, display_name, is_deleted)
    VALUES (NULL, 'personal', child_record.child_name, false)
    RETURNING id INTO new_profile_id;

    -- Populate the chart of accounts from templates
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
      new_profile_id,
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

    -- Update the child_profile to reference this new virtual profile
    UPDATE child_profiles
    SET owned_by_profile_id = new_profile_id
    WHERE id = child_record.id;

  END LOOP;
END $$;