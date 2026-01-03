/*
  # Create Auto-Activation Triggers for Accounts

  ## Overview
  Automatically activate accounts in user_chart_of_accounts when they receive operational data.
  This ensures that only accounts being used are visible by default.

  ## Activation Rules
  An account is automatically activated when:
  1. Current balance is set to a non-zero value
  2. Institution name is added
  3. Plaid account ID is linked
  4. Account receives transactions
  5. Account is added to a budget

  ## Triggers Created
  - activate_chart_account_on_balance_update
  - activate_chart_account_on_transaction
  - activate_chart_account_on_budget
*/

-- Function: Auto-activate account when balance or institution data is added
CREATE OR REPLACE FUNCTION auto_activate_chart_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Activate if balance is non-zero, institution is set, or plaid is linked
  IF (NEW.current_balance IS NOT NULL AND NEW.current_balance != 0)
     OR NEW.institution_name IS NOT NULL
     OR NEW.plaid_account_id IS NOT NULL
  THEN
    NEW.is_active = true;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger on user_chart_of_accounts UPDATE
DROP TRIGGER IF EXISTS trigger_auto_activate_chart_account ON user_chart_of_accounts;
CREATE TRIGGER trigger_auto_activate_chart_account
  BEFORE UPDATE ON user_chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION auto_activate_chart_account();

-- Function: Auto-activate account when a transaction uses it
CREATE OR REPLACE FUNCTION activate_chart_account_on_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Activate the chart account when a transaction references it
  IF NEW.chart_account_id IS NOT NULL THEN
    UPDATE user_chart_of_accounts
    SET is_active = true
    WHERE id = NEW.chart_account_id
      AND is_active = false;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger on transactions INSERT/UPDATE
DROP TRIGGER IF EXISTS trigger_activate_chart_account_on_transaction ON transactions;
CREATE TRIGGER trigger_activate_chart_account_on_transaction
  AFTER INSERT OR UPDATE OF chart_account_id ON transactions
  FOR EACH ROW
  WHEN (NEW.chart_account_id IS NOT NULL)
  EXECUTE FUNCTION activate_chart_account_on_transaction();

-- Function: Auto-activate account when added to budget
CREATE OR REPLACE FUNCTION activate_chart_account_on_budget()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Activate the chart account when a budget references it
  IF NEW.chart_account_id IS NOT NULL THEN
    UPDATE user_chart_of_accounts
    SET is_active = true
    WHERE id = NEW.chart_account_id
      AND is_active = false;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger on budgets INSERT/UPDATE
DROP TRIGGER IF EXISTS trigger_activate_chart_account_on_budget ON budgets;
CREATE TRIGGER trigger_activate_chart_account_on_budget
  AFTER INSERT OR UPDATE OF chart_account_id ON budgets
  FOR EACH ROW
  WHEN (NEW.chart_account_id IS NOT NULL)
  EXECUTE FUNCTION activate_chart_account_on_budget();
