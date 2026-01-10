/*
  # Fix Balance Update Trigger to Use Schema-Qualified Names

  ## Problem
  The balance update trigger functions use `SET search_path TO ''` for security,
  but reference tables without schema qualification, causing "relation does not exist" errors
  when deleting journal entries.

  ## Solution
  Update functions to use fully qualified table names (public.table_name)

  ## Impact
  - Fixes deletion errors when resetting financial data
  - Maintains security best practices with empty search_path
  - Balance calculations will continue to work correctly
*/

-- Function to recalculate account balance from all journal entries
CREATE OR REPLACE FUNCTION recalculate_account_balance(p_account_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_balance numeric := 0;
  v_account_class text;
BEGIN
  -- Get the account class (case insensitive)
  SELECT LOWER(class) INTO v_account_class
  FROM public.user_chart_of_accounts
  WHERE id = p_account_id;

  -- Calculate balance based on account class
  -- For assets and expenses: debits increase, credits decrease
  -- For liabilities, equity, and income: credits increase, debits decrease
  IF v_account_class IN ('asset', 'expense') THEN
    SELECT COALESCE(
      SUM(COALESCE(debit_amount, 0) - COALESCE(credit_amount, 0)),
      0
    )
    INTO v_balance
    FROM public.journal_entry_lines
    WHERE account_id = p_account_id;
  ELSE
    -- For liabilities, equity, and income
    SELECT COALESCE(
      SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)),
      0
    )
    INTO v_balance
    FROM public.journal_entry_lines
    WHERE account_id = p_account_id;
  END IF;

  RETURN v_balance;
END;
$$;

-- Function to update account balance when journal entry lines change
CREATE OR REPLACE FUNCTION update_account_balance_from_journal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    UPDATE public.user_chart_of_accounts
    SET current_balance = public.recalculate_account_balance(OLD.account_id)
    WHERE id = OLD.account_id;

    RETURN OLD;

  -- Handle UPDATE
  ELSIF TG_OP = 'UPDATE' THEN
    -- Update old account if it changed
    IF OLD.account_id != NEW.account_id THEN
      UPDATE public.user_chart_of_accounts
      SET current_balance = public.recalculate_account_balance(OLD.account_id)
      WHERE id = OLD.account_id;
    END IF;

    -- Update new account
    UPDATE public.user_chart_of_accounts
    SET current_balance = public.recalculate_account_balance(NEW.account_id)
    WHERE id = NEW.account_id;

    RETURN NEW;

  -- Handle INSERT
  ELSIF TG_OP = 'INSERT' THEN
    UPDATE public.user_chart_of_accounts
    SET current_balance = public.recalculate_account_balance(NEW.account_id)
    WHERE id = NEW.account_id;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION recalculate_account_balance IS
'Recalculates account balance from journal entries. Uses schema-qualified names for security.';

COMMENT ON FUNCTION update_account_balance_from_journal IS
'Updates account balances when journal entry lines change. Uses schema-qualified names for security.';
