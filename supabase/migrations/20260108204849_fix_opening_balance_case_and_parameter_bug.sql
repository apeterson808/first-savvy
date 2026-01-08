/*
  # Fix Opening Balance Function - Case Sensitivity and Parameter Count
  
  1. Problems Fixed
    - Case sensitivity bug: Function checks for 'Asset' and 'Liability' (capitalized)
      but database stores 'asset' and 'liability' (lowercase)
    - Parameter count mismatch: Function calls create_journal_entry with 8 parameters
      but it only accepts 7 parameters (no 'posted' status parameter)
    - Result: 400 errors when importing accounts through simulator
    
  2. Root Cause
    - Migration 20260108161216 accidentally reverted earlier fixes
    - Migration 20260107144758 had correctly fixed the case sensitivity
    - Migration 20260107134050 removed the status parameter from create_journal_entry
    
  3. Solution
    - Use UPPER(p_account_class) for case-insensitive comparison
    - Call create_journal_entry with correct 7-parameter signature
    - Keep integer 3000 for equity account lookup (already correct)
    
  4. Impact
    - Statement imports will now work correctly
    - Opening balance journal entries will be created for assets and liabilities
    - No more 400 errors during account activation
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
  -- FIXED: Use UPPER() for case-insensitive comparison
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
  
  -- Create the journal entry with correct 7-parameter signature
  -- FIXED: Removed 'posted' status parameter (no longer exists in function signature)
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
'Creates opening balance journal entry for asset and liability accounts. Uses case-insensitive class comparison and calls create_journal_entry with correct 7-parameter signature.';
