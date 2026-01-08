/*
  # Fix activate_template_account - Only Create Opening Balance for Assets/Liabilities

  1. Problem
    - activate_template_account tries to create opening balance journal entries for ALL account types
    - create_opening_balance_journal_entry only accepts 'Asset' or 'Liability' classes
    - Results in error: "Account class must be Asset or Liability for opening balance entries"

  2. Solution
    - Only create opening balance journal entries for Asset and Liability accounts
    - Skip opening balance creation for Income, Expense, and Equity accounts
    - These account types don't need opening balances (they accumulate over time)

  3. Changes
    - Add account class check before creating opening balance journal entry
    - Allow function to complete successfully for all account types
    - Only provision Opening Balance Equity when actually needed
*/

DROP FUNCTION IF EXISTS activate_template_account(uuid, integer, text, numeric, text, text, date);

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
  v_user_id uuid;
  v_account_id uuid;
  v_template RECORD;
  v_account_class text;
  v_account_name text;
  v_opening_date date;
  v_equity_account_id uuid;
  v_equity_template RECORD;
BEGIN
  -- Get user_id from profile
  SELECT user_id INTO v_user_id
  FROM profiles
  WHERE id = p_profile_id;

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

  -- Get account class for journal entry logic
  SELECT class, display_name INTO v_account_class, v_account_name
  FROM user_chart_of_accounts
  WHERE id = v_account_id;

  -- Create opening balance journal entry ONLY for Asset and Liability accounts
  -- Income, Expense, and Equity accounts don't need opening balances
  IF p_initial_balance IS NOT NULL 
     AND p_initial_balance != 0 
     AND v_account_class IN ('Asset', 'Liability') THEN
    
    -- Ensure Opening Balance Equity account (3000) exists
    SELECT id INTO v_equity_account_id
    FROM user_chart_of_accounts
    WHERE profile_id = p_profile_id
    AND account_number = 3000;

    -- If equity account doesn't exist, create it from template
    IF v_equity_account_id IS NULL THEN
      SELECT * INTO v_equity_template
      FROM chart_of_accounts_templates
      WHERE account_number = 3000;

      IF v_equity_template IS NOT NULL THEN
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
          is_active,
          is_user_created
        )
        VALUES (
          p_profile_id,
          v_equity_template.account_number,
          v_equity_template.account_number,
          v_equity_template.display_name,
          v_equity_template.class,
          v_equity_template.account_detail,
          v_equity_template.account_type,
          v_equity_template.icon,
          v_equity_template.color,
          0,
          true,
          false
        )
        RETURNING id INTO v_equity_account_id;
      END IF;
    END IF;

    -- Use the provided opening balance date, or current date if not provided
    v_opening_date := COALESCE(p_opening_balance_date, CURRENT_DATE);

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

COMMENT ON FUNCTION activate_template_account IS
'Activates a template account for a profile with optional opening balance. Only creates opening balance journal entries for Asset and Liability accounts. Income, Expense, and Equity accounts are activated without opening balance entries.';
