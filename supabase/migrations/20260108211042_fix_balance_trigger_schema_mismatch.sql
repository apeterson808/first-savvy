/*
  # Fix Balance Update Trigger Schema Mismatch

  1. Problem
    - Balance update trigger references wrong column names
    - Uses chart_account_id instead of account_id
    - Uses line_type/amount instead of debit_amount/credit_amount
    - References status column that doesn't exist
    - Result: balances never update from journal entries

  2. Solution
    - Rewrite trigger functions to match actual schema
    - Remove status checks (all journal entries are posted)
    - Use correct column names
    - Recalculate all existing balances

  3. Impact
    - Savvy balance will now correctly reflect journal entries
    - Opening balance + all posted transactions = current balance
*/

-- Drop existing triggers and functions
DROP TRIGGER IF EXISTS trigger_update_account_balance ON journal_entry_lines;
DROP TRIGGER IF EXISTS trigger_update_balances_on_status_change ON journal_entries;
DROP FUNCTION IF EXISTS update_account_balance_from_journal();
DROP FUNCTION IF EXISTS update_balances_on_journal_status_change();
DROP FUNCTION IF EXISTS recalculate_account_balance(uuid);

-- Function to recalculate account balance from all journal entries
CREATE OR REPLACE FUNCTION recalculate_account_balance(p_account_id uuid)
RETURNS numeric AS $$
DECLARE
  v_balance numeric := 0;
  v_account_class text;
BEGIN
  -- Get the account class (case insensitive)
  SELECT LOWER(class) INTO v_account_class
  FROM user_chart_of_accounts
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
    FROM journal_entry_lines
    WHERE account_id = p_account_id;
  ELSE
    -- For liabilities, equity, and income
    SELECT COALESCE(
      SUM(COALESCE(credit_amount, 0) - COALESCE(debit_amount, 0)),
      0
    )
    INTO v_balance
    FROM journal_entry_lines
    WHERE account_id = p_account_id;
  END IF;

  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update account balance when journal entry lines change
CREATE OR REPLACE FUNCTION update_account_balance_from_journal()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    UPDATE user_chart_of_accounts
    SET current_balance = recalculate_account_balance(OLD.account_id)
    WHERE id = OLD.account_id;
    
    RETURN OLD;

  -- Handle UPDATE
  ELSIF TG_OP = 'UPDATE' THEN
    -- Update old account if it changed
    IF OLD.account_id != NEW.account_id THEN
      UPDATE user_chart_of_accounts
      SET current_balance = recalculate_account_balance(OLD.account_id)
      WHERE id = OLD.account_id;
    END IF;

    -- Update new account
    UPDATE user_chart_of_accounts
    SET current_balance = recalculate_account_balance(NEW.account_id)
    WHERE id = NEW.account_id;

    RETURN NEW;

  -- Handle INSERT
  ELSIF TG_OP = 'INSERT' THEN
    UPDATE user_chart_of_accounts
    SET current_balance = recalculate_account_balance(NEW.account_id)
    WHERE id = NEW.account_id;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on journal_entry_lines
CREATE TRIGGER trigger_update_account_balance
  AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_account_balance_from_journal();

-- Recalculate all existing account balances
UPDATE user_chart_of_accounts
SET current_balance = recalculate_account_balance(id)
WHERE id IN (
  SELECT DISTINCT account_id
  FROM journal_entry_lines
);

COMMENT ON FUNCTION recalculate_account_balance IS 
'Recalculates account balance from journal entries. Fixed to use correct column names: account_id, debit_amount, credit_amount.';
