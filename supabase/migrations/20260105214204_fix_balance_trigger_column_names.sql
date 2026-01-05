/*
  # Fix Balance Trigger Column Names

  1. Changes
    - Update recalculate_account_balance function to use correct column name (account_id)
    - Update update_account_balance_from_journal function to use correct column name
    
  2. Reason
    - Previous migration incorrectly referenced chart_account_id
    - Correct column name in journal_entry_lines is account_id
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
        WHEN debit_amount IS NOT NULL THEN debit_amount
        WHEN credit_amount IS NOT NULL THEN -credit_amount
        ELSE 0
      END
    ), 0)
    INTO v_balance
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    WHERE jel.account_id = p_account_id
      AND je.status = 'posted';
  ELSE
    -- For liabilities, equity, and income: credits increase, debits decrease
    -- Liabilities stored as positive = amount owed
    SELECT COALESCE(SUM(
      CASE
        WHEN credit_amount IS NOT NULL THEN credit_amount
        WHEN debit_amount IS NOT NULL THEN -debit_amount
        ELSE 0
      END
    ), 0)
    INTO v_balance
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    WHERE jel.account_id = p_account_id
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
      SET current_balance = recalculate_account_balance(OLD.account_id)
      WHERE id = OLD.account_id;
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
    IF OLD.account_id != NEW.account_id AND v_old_journal_status = 'posted' THEN
      UPDATE user_chart_of_accounts
      SET current_balance = recalculate_account_balance(OLD.account_id)
      WHERE id = OLD.account_id;
    END IF;

    -- Update new account if journal is posted
    IF v_journal_status = 'posted' THEN
      UPDATE user_chart_of_accounts
      SET current_balance = recalculate_account_balance(NEW.account_id)
      WHERE id = NEW.account_id;
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
      SET current_balance = recalculate_account_balance(NEW.account_id)
      WHERE id = NEW.account_id;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update the trigger for journal entry status changes
CREATE OR REPLACE FUNCTION update_balances_on_journal_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- If status changed to 'posted', recalculate all affected accounts
  IF NEW.status = 'posted' AND OLD.status != 'posted' THEN
    UPDATE user_chart_of_accounts
    SET current_balance = recalculate_account_balance(user_chart_of_accounts.id)
    WHERE id IN (
      SELECT DISTINCT account_id
      FROM journal_entry_lines
      WHERE journal_entry_id = NEW.id
    );
  END IF;

  -- If status changed from 'posted' to something else, recalculate all affected accounts
  IF OLD.status = 'posted' AND NEW.status != 'posted' THEN
    UPDATE user_chart_of_accounts
    SET current_balance = recalculate_account_balance(user_chart_of_accounts.id)
    WHERE id IN (
      SELECT DISTINCT account_id
      FROM journal_entry_lines
      WHERE journal_entry_id = NEW.id
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
