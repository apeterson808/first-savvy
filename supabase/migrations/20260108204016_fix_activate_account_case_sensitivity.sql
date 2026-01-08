/*
  # Fix Case Sensitivity Bug in activate_template_account
  
  1. Problem
    - Line 128 checks: `v_account_class IN ('Asset', 'Liability')`
    - Database stores class values as lowercase: 'asset', 'liability'
    - Result: Opening balance journal entries never created during statement imports
    
  2. Root Cause
    - JavaScript code sets class as lowercase (line 1611-1612 in AccountCreationWizard)
    - Database schema stores lowercase values
    - Function comparison was case-sensitive
    
  3. Solution
    - Use UPPER() for case-insensitive comparison
    - Matches pattern from create_opening_balance_journal_entry function (already fixed)
    - Changes: `v_account_class IN ('Asset', 'Liability')`
    - To: `UPPER(v_account_class) IN ('ASSET', 'LIABILITY')`
    
  4. Impact
    - Opening balance journal entries will now be created correctly
    - Statement imports will create proper opening balances
    - No other code changes needed - rest of the flow is working correctly
*/

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
    RAISE EXCEPTION 'Profile not found or has no user_id';
  END IF;

  -- Get template
  SELECT * INTO v_template
  FROM chart_of_accounts_templates
  WHERE account_number = p_template_account_number;

  IF v_template IS NULL THEN
    RAISE EXCEPTION 'Template account % not found', p_template_account_number;
  END IF;

  -- Check if account already exists
  SELECT id INTO v_account_id
  FROM user_chart_of_accounts
  WHERE profile_id = p_profile_id
  AND template_account_number = p_template_account_number
  AND is_active = true;

  IF v_account_id IS NOT NULL THEN
    RETURN v_account_id;
  END IF;

  -- Create account from template
  INSERT INTO user_chart_of_accounts (
    profile_id,
    user_id,
    template_account_number,
    account_number,
    display_name,
    class,
    account_type,
    account_detail,
    icon,
    color,
    current_balance,
    bank_balance,
    institution_name,
    account_number_last4,
    is_active,
    is_user_created
  )
  VALUES (
    p_profile_id,
    v_user_id,
    v_template.account_number,
    v_template.account_number,
    COALESCE(p_custom_display_name, v_template.display_name),
    v_template.class,
    v_template.account_type,
    v_template.account_detail,
    v_template.icon,
    v_template.color,
    COALESCE(p_initial_balance, 0),
    COALESCE(p_initial_balance, 0),
    p_institution_name,
    p_account_number_last4,
    true,
    false
  )
  RETURNING id INTO v_account_id;

  -- Get account class and name for journal entry
  SELECT class, display_name INTO v_account_class, v_account_name
  FROM user_chart_of_accounts
  WHERE id = v_account_id;

  -- Create opening balance journal entry ONLY for Asset and Liability accounts
  -- Income, Expense, and Equity accounts don't need opening balances
  -- FIXED: Use UPPER() for case-insensitive comparison
  IF p_initial_balance IS NOT NULL
     AND p_initial_balance != 0
     AND UPPER(v_account_class) IN ('ASSET', 'LIABILITY') THEN
    
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
          user_id,
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
          v_user_id,
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
'Activates an account template for a user profile with optional initial balance and opening balance journal entry for assets/liabilities only';
