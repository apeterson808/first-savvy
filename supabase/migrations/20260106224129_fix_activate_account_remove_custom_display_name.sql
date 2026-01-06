/*
  # Fix activate_template_account Function - Remove custom_display_name Column

  ## Issue
  The activate_template_account function references custom_display_name column that doesn't exist
  in the user_chart_of_accounts table. The table only has display_name.

  ## Fix
  - Remove custom_display_name from INSERT and UPDATE statements
  - Use display_name directly with custom name if provided
  - Simplify logic to match actual schema

  ## Impact
  - Fixes 400 error when activating template accounts
  - Aligns with current schema
*/

-- Drop the existing function
DROP FUNCTION IF EXISTS activate_template_account(uuid, integer, text, numeric, text, text, date);

-- Recreate without custom_display_name references
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
  v_user_id uuid;
BEGIN
  -- Verify profile exists and get user_id
  SELECT user_id INTO v_user_id FROM profiles WHERE id = p_profile_id;
  
  IF v_user_id IS NULL THEN
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
      display_name = COALESCE(p_custom_display_name, display_name),
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
      COALESCE(p_custom_display_name, v_template.display_name),
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
    SELECT class, display_name INTO v_account_class, v_account_name
    FROM user_chart_of_accounts
    WHERE id = v_account_id;

    -- Set opening date: if provided, use it minus 1 day; otherwise use current date minus 1 day
    v_opening_date := COALESCE(p_opening_balance_date, CURRENT_DATE) - INTERVAL '1 day';

    -- Create the opening balance journal entry
    PERFORM create_opening_balance_journal_entry(
      p_profile_id := p_profile_id,
      p_user_id := v_user_id,
      p_account_id := v_account_id,
      p_opening_balance := p_initial_balance,
      p_opening_date := v_opening_date,
      p_account_name := v_account_name,
      p_account_class := v_account_class
    );
  END IF;

  RETURN v_account_id;
END;
$$;
