/*
  # Fix Activate Account Function Column References

  ## Changes
  Fixes the activate_template_account function to use correct columns
  - Removes user_id from INSERT (only profile_id exists)
  - Ensures all referenced columns exist in the table
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

  SELECT id INTO v_account_id
  FROM user_chart_of_accounts
  WHERE profile_id = p_profile_id
    AND template_account_number = p_template_account_number;

  IF v_account_id IS NOT NULL THEN
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