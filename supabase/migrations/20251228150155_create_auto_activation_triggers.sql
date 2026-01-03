/*
  # Create Auto-Activation Triggers for Chart of Accounts

  ## Overview
  Automatically activate chart of accounts entries when they're actually being used:
  - Balance sheet accounts (asset, liability, equity): Activate when linked to real accounts
  - Income/expense accounts: Activate when added to budget or used in transactions

  ## Functions Created
  1. `activate_chart_account_for_bank_account()` - Activates when bank account is linked
  2. `activate_chart_account_for_asset()` - Activates when asset is created
  3. `activate_chart_account_for_liability()` - Activates when liability is created
  4. `activate_chart_account_for_equity()` - Activates when equity is created
  5. `activate_chart_account_for_budget()` - Activates when budget is created
  6. `deactivate_chart_account_for_budget()` - Deactivates when last budget is deleted
  7. `activate_chart_account_for_transaction()` - Activates when first transaction is created

  ## Triggers Created
  - Triggers on accounts, assets, liabilities, equity, budgets, and transactions tables
*/

-- Function to activate chart account when bank account is linked
CREATE OR REPLACE FUNCTION activate_chart_account_for_bank_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.chart_account_id IS NOT NULL THEN
    UPDATE user_chart_of_accounts
    SET is_active = true, updated_at = now()
    WHERE id = NEW.chart_account_id AND is_active = false;
  END IF;
  RETURN NEW;
END;
$$;

-- Function to activate chart account when account is linked
CREATE OR REPLACE FUNCTION activate_chart_account_for_account()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.chart_account_id IS NOT NULL THEN
    UPDATE user_chart_of_accounts
    SET is_active = true, updated_at = now()
    WHERE id = NEW.chart_account_id AND is_active = false;
  END IF;
  RETURN NEW;
END;
$$;

-- Function to activate chart account when credit card is linked
CREATE OR REPLACE FUNCTION activate_chart_account_for_credit_card()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.chart_account_id IS NOT NULL THEN
    UPDATE user_chart_of_accounts
    SET is_active = true, updated_at = now()
    WHERE id = NEW.chart_account_id AND is_active = false;
  END IF;
  RETURN NEW;
END;
$$;

-- Function to activate chart account when asset is created
CREATE OR REPLACE FUNCTION activate_chart_account_for_asset()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.chart_account_id IS NOT NULL THEN
    UPDATE user_chart_of_accounts
    SET is_active = true, updated_at = now()
    WHERE id = NEW.chart_account_id AND is_active = false;
  END IF;
  RETURN NEW;
END;
$$;

-- Function to activate chart account when liability is created
CREATE OR REPLACE FUNCTION activate_chart_account_for_liability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.chart_account_id IS NOT NULL THEN
    UPDATE user_chart_of_accounts
    SET is_active = true, updated_at = now()
    WHERE id = NEW.chart_account_id AND is_active = false;
  END IF;
  RETURN NEW;
END;
$$;

-- Function to activate chart account when equity is created
CREATE OR REPLACE FUNCTION activate_chart_account_for_equity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.chart_account_id IS NOT NULL THEN
    UPDATE user_chart_of_accounts
    SET is_active = true, updated_at = now()
    WHERE id = NEW.chart_account_id AND is_active = false;
  END IF;
  RETURN NEW;
END;
$$;

-- Function to activate chart account when budget is created
CREATE OR REPLACE FUNCTION activate_chart_account_for_budget()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.chart_account_id IS NOT NULL THEN
    UPDATE user_chart_of_accounts
    SET is_active = true, updated_at = now()
    WHERE id = NEW.chart_account_id AND is_active = false;
  END IF;
  RETURN NEW;
END;
$$;

-- Function to deactivate chart account when budget is deleted (only if no other budgets exist)
CREATE OR REPLACE FUNCTION deactivate_chart_account_for_budget()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_other_budgets boolean;
  v_has_transactions boolean;
BEGIN
  IF OLD.chart_account_id IS NOT NULL THEN
    -- Check if there are other budgets for this chart account
    SELECT EXISTS(
      SELECT 1 FROM budgets
      WHERE chart_account_id = OLD.chart_account_id
      AND id != OLD.id
    ) INTO v_has_other_budgets;
    
    -- Check if there are transactions for this chart account
    SELECT EXISTS(
      SELECT 1 FROM transactions
      WHERE chart_account_id = OLD.chart_account_id
    ) INTO v_has_transactions;
    
    -- Only deactivate if no other budgets and no transactions exist
    IF NOT v_has_other_budgets AND NOT v_has_transactions THEN
      UPDATE user_chart_of_accounts
      SET is_active = false, updated_at = now()
      WHERE id = OLD.chart_account_id AND is_active = true;
    END IF;
  END IF;
  RETURN OLD;
END;
$$;

-- Function to activate chart account when transaction is created
CREATE OR REPLACE FUNCTION activate_chart_account_for_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.chart_account_id IS NOT NULL THEN
    UPDATE user_chart_of_accounts
    SET is_active = true, updated_at = now()
    WHERE id = NEW.chart_account_id AND is_active = false;
  END IF;
  RETURN NEW;
END;
$$;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_activate_chart_for_bank_account ON bank_accounts;
DROP TRIGGER IF EXISTS trigger_activate_chart_for_account ON accounts;
DROP TRIGGER IF EXISTS trigger_activate_chart_for_credit_card ON credit_cards;
DROP TRIGGER IF EXISTS trigger_activate_chart_for_asset ON assets;
DROP TRIGGER IF EXISTS trigger_activate_chart_for_liability ON liabilities;
DROP TRIGGER IF EXISTS trigger_activate_chart_for_equity ON equity;
DROP TRIGGER IF EXISTS trigger_activate_chart_for_budget ON budgets;
DROP TRIGGER IF EXISTS trigger_deactivate_chart_for_budget ON budgets;
DROP TRIGGER IF EXISTS trigger_activate_chart_for_transaction ON transactions;

-- Create triggers for bank_accounts
CREATE TRIGGER trigger_activate_chart_for_bank_account
  AFTER INSERT OR UPDATE OF chart_account_id ON bank_accounts
  FOR EACH ROW
  EXECUTE FUNCTION activate_chart_account_for_bank_account();

-- Create triggers for accounts (transactional accounts)
CREATE TRIGGER trigger_activate_chart_for_account
  AFTER INSERT OR UPDATE OF chart_account_id ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION activate_chart_account_for_account();

-- Create triggers for credit_cards
CREATE TRIGGER trigger_activate_chart_for_credit_card
  AFTER INSERT OR UPDATE OF chart_account_id ON credit_cards
  FOR EACH ROW
  EXECUTE FUNCTION activate_chart_account_for_credit_card();

-- Create triggers for assets
CREATE TRIGGER trigger_activate_chart_for_asset
  AFTER INSERT OR UPDATE OF chart_account_id ON assets
  FOR EACH ROW
  EXECUTE FUNCTION activate_chart_account_for_asset();

-- Create triggers for liabilities
CREATE TRIGGER trigger_activate_chart_for_liability
  AFTER INSERT OR UPDATE OF chart_account_id ON liabilities
  FOR EACH ROW
  EXECUTE FUNCTION activate_chart_account_for_liability();

-- Create triggers for equity
CREATE TRIGGER trigger_activate_chart_for_equity
  AFTER INSERT OR UPDATE OF chart_account_id ON equity
  FOR EACH ROW
  EXECUTE FUNCTION activate_chart_account_for_equity();

-- Create triggers for budgets
CREATE TRIGGER trigger_activate_chart_for_budget
  AFTER INSERT OR UPDATE OF chart_account_id ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION activate_chart_account_for_budget();

CREATE TRIGGER trigger_deactivate_chart_for_budget
  AFTER DELETE ON budgets
  FOR EACH ROW
  EXECUTE FUNCTION deactivate_chart_account_for_budget();

-- Create triggers for transactions
CREATE TRIGGER trigger_activate_chart_for_transaction
  AFTER INSERT OR UPDATE OF chart_account_id ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION activate_chart_account_for_transaction();
