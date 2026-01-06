/*
  # Fix activate_template_account Function - Remove user_id Column Reference

  ## Issue
  The activate_template_account function is trying to insert into user_chart_of_accounts
  with a user_id column that doesn't exist in the table. The table only uses profile_id.

  ## Fix
  - Remove user_id column from INSERT statement
  - Remove user_id variable declaration
  - Remove user_id lookup logic
  - Function only needs profile_id which is already a parameter

  ## Impact
  - Fixes 400 error when activating template accounts
  - Aligns with current schema that removed user_id in favor of profile_id only
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS activate_template_account(uuid, integer, text, numeric, text, text, date);

-- Recreate without user_id references
CREATE OR REPLACE FUNCTION activate_template_account(
  p_profile_id uuid,
  p_template_account_number integer,
  p_custom_display_name text DEFAULT NULL,
  p_initial_balance numeric DEFAULT NULL,
  p_institution_name text DEFAULT NULL,
  p_account_number_last4 text DEFAULT NULL,
  p_opening_balance_date date DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_template RECORD;
  v_account_class text;
  v_account_name text;
  v_opening_date date;
BEGIN
  -- Verify profile exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id) THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Get template account details
  SELECT * INTO v_template
  FROM chart_of_accounts_templates
  WHERE account_number = p_template_account_number;

  IF v_template IS NULL THEN
    RAISE EXCEPTION 'Template account % not found', p_template_account_number;
  END IF;

  -- Check if account already exists for this profile
  SELECT id INTO v_account_id
  FROM user_chart_of_accounts
  WHERE profile_id = p_profile_id
    AND template_account_number = p_template_account_number;

  -- Activate existing account or create new one
  IF v_account_id IS NOT NULL THEN
    -- Update existing account
    UPDATE user_chart_of_accounts
    SET
      is_active = true,
      custom_display_name = COALESCE(p_custom_display_name, custom_display_name),
      current_balance = COALESCE(p_initial_balance, current_balance),
      institution_name = COALESCE(p_institution_name, institution_name),
      account_number_last4 = COALESCE(p_account_number_last4, account_number_last4),
      updated_at = now()
    WHERE id = v_account_id;
  ELSE
    -- Create new account from template
    INSERT INTO user_chart_of_accounts (
      profile_id,
      template_account_number,
      account_number,
      display_name,
      custom_display_name,
      class,
      account_detail,
      account_type,
      icon,
      color,
      current_balance,
      institution_name,
      account_number_last4,
      is_active,
      is_user_created
    )
    VALUES (
      p_profile_id,
      v_template.account_number,
      v_template.account_number,
      v_template.display_name,
      p_custom_display_name,
      v_template.class,
      v_template.account_detail,
      v_template.account_type,
      v_template.icon,
      v_template.color,
      p_initial_balance,
      p_institution_name,
      p_account_number_last4,
      true,
      false
    )
    RETURNING id INTO v_account_id;
  END IF;

  -- Create opening balance journal entry if initial balance is provided and non-zero
  IF p_initial_balance IS NOT NULL AND p_initial_balance != 0 THEN
    -- Get account details for journal entry
    SELECT class, COALESCE(custom_display_name, display_name) INTO v_account_class, v_account_name
    FROM user_chart_of_accounts
    WHERE id = v_account_id;

    -- Set opening date: if provided, use it minus 1 day; otherwise use current date minus 1 day
    v_opening_date := COALESCE(p_opening_balance_date, CURRENT_DATE) - INTERVAL '1 day';

    -- Create the opening balance journal entry
    -- Note: create_opening_balance_journal_entry needs user_id, so we get it from profile
    DECLARE
      v_user_id uuid;
    BEGIN
      SELECT user_id INTO v_user_id FROM profiles WHERE id = p_profile_id;
      
      PERFORM create_opening_balance_journal_entry(
        p_profile_id := p_profile_id,
        p_user_id := v_user_id,
        p_account_id := v_account_id,
        p_opening_balance := p_initial_balance,
        p_opening_date := v_opening_date,
        p_account_name := v_account_name,
        p_account_class := v_account_class
      );
    END;
  END IF;

  RETURN v_account_id;
END;
$$;
