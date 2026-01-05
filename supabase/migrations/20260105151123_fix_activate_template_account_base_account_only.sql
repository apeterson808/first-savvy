/*
  # Fix activate_template_account to Only Select Base Template Accounts

  ## Problem
  The function was selecting ANY account with the matching template_account_number,
  including derived accounts (2001, 2002, etc). This caused it to update existing
  accounts instead of activating the base template account.

  ## Solution
  Add condition to only select accounts where account_number = template_account_number,
  ensuring we only activate the base template account (e.g., 2000, not 2001).

  ## Changes
  - Updates the SELECT query to filter for base template accounts only
  - Ensures first account always gets the template number (2000)
  - Subsequent accounts correctly get incremented numbers (2001, 2002, etc)
*/

CREATE OR REPLACE FUNCTION activate_template_account(
  p_profile_id uuid,
  p_template_account_number integer,
  p_custom_display_name text DEFAULT NULL,
  p_initial_balance numeric DEFAULT NULL,
  p_institution_name text DEFAULT NULL,
  p_account_number_last4 text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_template RECORD;
BEGIN
  SELECT * INTO v_template
  FROM chart_of_accounts_templates
  WHERE account_number = p_template_account_number;

  IF v_template IS NULL THEN
    RAISE EXCEPTION 'Template account % not found', p_template_account_number;
  END IF;

  -- Only select the BASE template account, not derived accounts
  SELECT id INTO v_account_id
  FROM user_chart_of_accounts
  WHERE profile_id = p_profile_id
    AND template_account_number = p_template_account_number
    AND account_number = template_account_number;

  IF v_account_id IS NOT NULL THEN
    -- Base template account exists, activate it
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
    -- No base template account exists, create one
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

  RETURN v_account_id;
END;
$$;
