/*
  # Ensure Opening Balance Equity Account is Provisioned

  ## Issue
  When activating accounts with opening balances, the system tries to create journal entries
  that reference the Opening Balance Equity account (3000), but this account may not exist
  in the user's chart of accounts yet.

  ## Fix
  - Update activate_template_account to auto-provision account 3000 if needed
  - Ensure account 3000 is active before creating journal entries
  - Fix account_number comparison (should be integer, not text)

  ## Impact
  - Users can successfully complete the simulator import
  - Opening balance journal entries work correctly
*/

-- Fix the create_opening_balance_journal_entry function to use integer comparison
CREATE OR REPLACE FUNCTION create_opening_balance_journal_entry(
  p_profile_id uuid,
  p_user_id uuid,
  p_account_id uuid,
  p_opening_balance numeric,
  p_opening_date date,
  p_account_name text,
  p_account_class text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_equity_account_id uuid;
  v_lines jsonb;
  v_result jsonb;
  v_abs_amount numeric;
  v_account_class_lower text;
BEGIN
  -- Convert class to lowercase for consistent comparison
  v_account_class_lower := LOWER(p_account_class);
  
  -- Get the Opening Balance Equity account (account number 3000)
  SELECT id INTO v_equity_account_id
  FROM user_chart_of_accounts
  WHERE profile_id = p_profile_id
  AND account_number = 3000
  LIMIT 1;
  
  IF v_equity_account_id IS NULL THEN
    RAISE EXCEPTION 'Opening Balance Equity account (3000) not found for profile';
  END IF;
  
  -- Use absolute value for amounts
  v_abs_amount := ABS(p_opening_balance);
  
  -- Determine debit/credit structure based on account class and balance sign
  IF v_account_class_lower = 'asset' THEN
    IF p_opening_balance > 0 THEN
      v_lines := jsonb_build_array(
        jsonb_build_object(
          'account_id', p_account_id,
          'debit_amount', v_abs_amount,
          'credit_amount', NULL,
          'description', 'Opening balance'
        ),
        jsonb_build_object(
          'account_id', v_equity_account_id,
          'debit_amount', NULL,
          'credit_amount', v_abs_amount,
          'description', 'Opening balance equity for ' || p_account_name
        )
      );
    ELSIF p_opening_balance < 0 THEN
      v_lines := jsonb_build_array(
        jsonb_build_object(
          'account_id', v_equity_account_id,
          'debit_amount', v_abs_amount,
          'credit_amount', NULL,
          'description', 'Opening balance equity for ' || p_account_name
        ),
        jsonb_build_object(
          'account_id', p_account_id,
          'debit_amount', NULL,
          'credit_amount', v_abs_amount,
          'description', 'Opening balance'
        )
      );
    ELSE
      RAISE EXCEPTION 'Opening balance cannot be zero';
    END IF;
  ELSIF v_account_class_lower = 'liability' THEN
    IF p_opening_balance > 0 THEN
      v_lines := jsonb_build_array(
        jsonb_build_object(
          'account_id', v_equity_account_id,
          'debit_amount', v_abs_amount,
          'credit_amount', NULL,
          'description', 'Opening balance equity for ' || p_account_name
        ),
        jsonb_build_object(
          'account_id', p_account_id,
          'debit_amount', NULL,
          'credit_amount', v_abs_amount,
          'description', 'Opening balance'
        )
      );
    ELSIF p_opening_balance < 0 THEN
      v_lines := jsonb_build_array(
        jsonb_build_object(
          'account_id', p_account_id,
          'debit_amount', v_abs_amount,
          'credit_amount', NULL,
          'description', 'Opening balance'
        ),
        jsonb_build_object(
          'account_id', v_equity_account_id,
          'debit_amount', NULL,
          'credit_amount', v_abs_amount,
          'description', 'Opening balance equity for ' || p_account_name
        )
      );
    ELSE
      RAISE EXCEPTION 'Opening balance cannot be zero';
    END IF;
  ELSE
    RAISE EXCEPTION 'Account class must be Asset or Liability for opening balance entries';
  END IF;
  
  -- Create the journal entry
  v_result := create_journal_entry(
    p_profile_id,
    p_user_id,
    p_opening_date,
    'Opening balance for ' || p_account_name,
    'opening_balance',
    'posted',
    'system',
    v_lines
  );
  
  RETURN v_result;
END;
$$;

-- Update activate_template_account to ensure account 3000 exists
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
  v_equity_account_id uuid;
  v_equity_template RECORD;
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
