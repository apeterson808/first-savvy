/*
  # Create Balance Update Trigger for Journal Entries

  1. Functions Created
    - `update_account_balance_from_journal()` - Updates account balances when journal entries change
    - `recalculate_account_balance()` - Recalculates balance from all posted journal entries

  2. Trigger Created
    - `trigger_update_account_balance` - Fires after journal_entry_lines INSERT/UPDATE/DELETE

  3. Accounting Logic (QuickBooks-style)
    - ASSET accounts: Debits increase balance, Credits decrease balance
    - EXPENSE accounts: Debits increase balance, Credits decrease balance
    - LIABILITY accounts: Credits increase balance, Debits decrease balance (stored as positive = owed)
    - EQUITY accounts: Credits increase balance, Debits decrease balance
    - INCOME accounts: Credits increase balance, Debits decrease balance

  4. Important Notes
    - Only processes journal entries with status = 'posted'
    - Liabilities stored as POSITIVE numbers representing amount owed (QuickBooks convention)
    - Trigger updates both old and new accounts when journal lines are modified
*/

-- Function to recalculate account balance from all posted journal entries
CREATE OR REPLACE FUNCTION recalculate_account_balance(p_account_id uuid)
RETURNS numeric AS $$
DECLARE
  v_balance numeric := 0;
  v_account_class text;
BEGIN
  -- Get the account class
  SELECT class INTO v_account_class
  FROM user_chart_of_accounts
  WHERE id = p_account_id;

  -- Calculate balance based on account class
  IF v_account_class IN ('asset', 'expense') THEN
    -- For assets and expenses: debits increase, credits decrease
    SELECT COALESCE(SUM(
      CASE
        WHEN line_type = 'debit' THEN amount
        WHEN line_type = 'credit' THEN -amount
        ELSE 0
      END
    ), 0)
    INTO v_balance
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    WHERE jel.chart_account_id = p_account_id
      AND je.status = 'posted';
  ELSE
    -- For liabilities, equity, and income: credits increase, debits decrease
    -- Liabilities stored as positive = amount owed
    SELECT COALESCE(SUM(
      CASE
        WHEN line_type = 'credit' THEN amount
        WHEN line_type = 'debit' THEN -amount
        ELSE 0
      END
    ), 0)
    INTO v_balance
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    WHERE jel.chart_account_id = p_account_id
      AND je.status = 'posted';
  END IF;

  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update account balance when journal entries change
CREATE OR REPLACE FUNCTION update_account_balance_from_journal()
RETURNS TRIGGER AS $$
DECLARE
  v_journal_status text;
  v_old_journal_status text;
  v_account_id uuid;
  v_old_account_id uuid;
BEGIN
  -- Handle different trigger operations
  IF TG_OP = 'DELETE' THEN
    -- Get the journal entry status for the deleted line
    SELECT status INTO v_journal_status
    FROM journal_entries
    WHERE id = OLD.journal_entry_id;

    -- Only update if the journal entry was posted
    IF v_journal_status = 'posted' THEN
      UPDATE user_chart_of_accounts
      SET current_balance = recalculate_account_balance(OLD.chart_account_id)
      WHERE id = OLD.chart_account_id;
    END IF;

    RETURN OLD;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Get journal entry status
    SELECT status INTO v_journal_status
    FROM journal_entries
    WHERE id = NEW.journal_entry_id;

    -- If journal entry status changed, get old status
    IF OLD.journal_entry_id != NEW.journal_entry_id THEN
      SELECT status INTO v_old_journal_status
      FROM journal_entries
      WHERE id = OLD.journal_entry_id;
    ELSE
      v_old_journal_status := v_journal_status;
    END IF;

    -- Update old account if it changed and old journal was posted
    IF OLD.chart_account_id != NEW.chart_account_id AND v_old_journal_status = 'posted' THEN
      UPDATE user_chart_of_accounts
      SET current_balance = recalculate_account_balance(OLD.chart_account_id)
      WHERE id = OLD.chart_account_id;
    END IF;

    -- Update new account if journal is posted
    IF v_journal_status = 'posted' THEN
      UPDATE user_chart_of_accounts
      SET current_balance = recalculate_account_balance(NEW.chart_account_id)
      WHERE id = NEW.chart_account_id;
    END IF;

    RETURN NEW;

  ELSIF TG_OP = 'INSERT' THEN
    -- Get journal entry status
    SELECT status INTO v_journal_status
    FROM journal_entries
    WHERE id = NEW.journal_entry_id;

    -- Only update if journal entry is posted
    IF v_journal_status = 'posted' THEN
      UPDATE user_chart_of_accounts
      SET current_balance = recalculate_account_balance(NEW.chart_account_id)
      WHERE id = NEW.chart_account_id;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on journal_entry_lines
DROP TRIGGER IF EXISTS trigger_update_account_balance ON journal_entry_lines;
CREATE TRIGGER trigger_update_account_balance
  AFTER INSERT OR UPDATE OR DELETE ON journal_entry_lines
  FOR EACH ROW
  EXECUTE FUNCTION update_account_balance_from_journal();

-- Also need to handle when journal entry status changes from draft to posted
CREATE OR REPLACE FUNCTION update_balances_on_journal_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changed to 'posted', recalculate all affected accounts
  IF NEW.status = 'posted' AND OLD.status != 'posted' THEN
    UPDATE user_chart_of_accounts
    SET current_balance = recalculate_account_balance(user_chart_of_accounts.id)
    WHERE id IN (
      SELECT DISTINCT chart_account_id
      FROM journal_entry_lines
      WHERE journal_entry_id = NEW.id
    );
  END IF;

  -- If status changed from 'posted' to something else, recalculate all affected accounts
  IF OLD.status = 'posted' AND NEW.status != 'posted' THEN
    UPDATE user_chart_of_accounts
    SET current_balance = recalculate_account_balance(user_chart_of_accounts.id)
    WHERE id IN (
      SELECT DISTINCT chart_account_id
      FROM journal_entry_lines
      WHERE journal_entry_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on journal_entries for status changes
DROP TRIGGER IF EXISTS trigger_update_balances_on_status_change ON journal_entries;
CREATE TRIGGER trigger_update_balances_on_status_change
  AFTER UPDATE ON journal_entries
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION update_balances_on_journal_status_change();

-- Add comment to document the convention
COMMENT ON COLUMN user_chart_of_accounts.current_balance IS 'Account balance calculated from journal entries. For LIABILITY accounts: positive = amount owed (QuickBooks convention)';
