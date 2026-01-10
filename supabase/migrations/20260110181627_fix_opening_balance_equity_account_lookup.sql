/*
  # Fix Opening Balance Equity Account Lookup

  ## Problem
  The create_opening_balance_journal_entry function queries user_chart_of_accounts
  using 'profile_id' column, but that table only has 'user_id' column.

  This causes the equity account lookup to fail/return NULL, resulting in:
  - Both journal entry lines getting the same account_id (the checking account)
  - Duplicate entries appearing in the account register
  - Balance being double-counted

  ## Root Cause
  Schema mismatch between tables:
  - journal_entries and journal_entry_lines have profile_id
  - user_chart_of_accounts only has user_id
  - Function incorrectly queries for profile_id on user_chart_of_accounts

  ## Solution
  Update the equity account lookup query to use user_id instead of profile_id

  ## Impact
  - Opening balance journal entries will correctly create two lines with different accounts
  - Account register will show proper journal entry structure
  - Balances will calculate correctly
*/

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
BEGIN
  -- FIXED: Query by user_id instead of profile_id (user_chart_of_accounts only has user_id)
  SELECT id INTO v_equity_account_id
  FROM user_chart_of_accounts
  WHERE user_id = p_user_id
  AND account_number = 3000
  LIMIT 1;

  IF v_equity_account_id IS NULL THEN
    RAISE EXCEPTION 'Opening Balance Equity account (3000) not found for user %', p_user_id;
  END IF;

  -- Use absolute value for amounts
  v_abs_amount := ABS(p_opening_balance);

  -- Determine debit/credit structure based on account class and balance sign
  IF UPPER(p_account_class) = 'ASSET' THEN
    IF p_opening_balance > 0 THEN
      -- Normal asset: Debit Asset, Credit Equity
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
      -- Negative asset (unusual): Debit Equity, Credit Asset
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
  ELSIF UPPER(p_account_class) = 'LIABILITY' THEN
    IF p_opening_balance > 0 THEN
      -- Normal liability (positive balance = amount owed): Debit Equity, Credit Liability
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
      -- Negative liability (credit on account): Debit Liability, Credit Equity
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
    'system',
    v_lines
  );

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION create_opening_balance_journal_entry IS
'Creates opening balance journal entry for asset and liability accounts. Fixed to query user_chart_of_accounts by user_id instead of profile_id.';
