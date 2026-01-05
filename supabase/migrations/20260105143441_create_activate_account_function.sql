/*
  # Create Account Activation Function

  ## Overview
  Creates a function to activate template accounts on-demand when users need them.
  This enables the on-demand account creation pattern.

  ## Function: activate_template_account
  - Checks if template account exists in user's chart of accounts
  - If exists but inactive, activates it and applies any customizations
  - If doesn't exist, creates new account from template
  - Returns the activated account ID

  ## Parameters
  - p_profile_id: User's profile ID
  - p_template_account_number: Template account number to activate
  - p_custom_display_name: Optional custom name for the account
  - p_initial_balance: Optional starting balance
  - p_institution_name: Optional bank/institution name
  - p_account_number_last4: Optional last 4 digits of account number

  ## Security
  Function is SECURITY DEFINER to allow activating template accounts
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
  v_user_id uuid;
  v_account_id uuid;
  v_template RECORD;
BEGIN
  SELECT user_id INTO v_user_id
  FROM profiles
  WHERE id = p_profile_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  SELECT * INTO v_template
  FROM chart_of_accounts_templates
  WHERE account_number = p_template_account_number;

  IF v_template IS NULL THEN
    RAISE EXCEPTION 'Template account % not found', p_template_account_number;
  END IF;

  SELECT id INTO v_account_id
  FROM user_chart_of_accounts
  WHERE profile_id = p_profile_id
    AND template_account_number = p_template_account_number;

  IF v_account_id IS NOT NULL THEN
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
    INSERT INTO user_chart_of_accounts (
      user_id,
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
      v_user_id,
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

  RETURN v_account_id;
END;
$$;