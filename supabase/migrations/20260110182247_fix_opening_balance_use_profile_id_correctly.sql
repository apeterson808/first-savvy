/*
  # Fix Opening Balance Function - Use profile_id Correctly

  ## Problem
  Previous migration changed the equity account lookup to use user_id,
  but user_chart_of_accounts table actually has profile_id, not user_id.

  ## Root Cause
  Confusion between:
  - user_chart_of_accounts has profile_id (correct)
  - journal_entries and journal_entry_lines have both profile_id and user_id
  - The function should query user_chart_of_accounts by profile_id

  ## Solution
  Change the equity account lookup back to use profile_id (which is correct)

  ## Impact
  - Function will correctly find the Opening Balance Equity account
  - Opening balance journal entries will be created properly
  - Account imports will work
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
  -- Query by profile_id (user_chart_of_accounts has profile_id, not user_id)
  SELECT id INTO v_equity_account_id
  FROM user_chart_of_accounts
  WHERE profile_id = p_profile_id
  AND account_number = 3000
  LIMIT 1;

  IF v_equity_account_id IS NULL THEN
    RAISE EXCEPTION 'Opening Balance Equity account (3000) not found for profile %', p_profile_id;
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
'Creates opening balance journal entry for asset and liability accounts. Correctly queries user_chart_of_accounts by profile_id.';
