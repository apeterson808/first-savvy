/*
  # Fix Column Name in Balance Calculation Functions
  
  ## Problem
  The recalculate_account_balance and related functions use `chart_account_id` 
  but the actual column name in journal_entry_lines is `account_id`.
  
  ## Fix
  Update all functions to use the correct column name `account_id`.
*/

-- Fix recalculate_account_balance function
CREATE OR REPLACE FUNCTION recalculate_account_balance(p_account_id uuid)
RETURNS numeric AS $$
DECLARE
  v_balance numeric := 0;
  v_account_class text;
BEGIN
  SELECT class INTO v_account_class
  FROM user_chart_of_accounts
  WHERE id = p_account_id;

  IF v_account_class IN ('asset', 'expense') THEN
    SELECT COALESCE(SUM(
      CASE
        WHEN jel.debit_amount IS NOT NULL THEN jel.debit_amount
        WHEN jel.credit_amount IS NOT NULL THEN -jel.credit_amount
        ELSE 0
      END
    ), 0)
    INTO v_balance
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    LEFT JOIN transactions t ON t.journal_entry_id = je.id
    WHERE jel.account_id = p_account_id
      AND (t.id IS NULL OR t.status = 'posted');
  ELSE
    SELECT COALESCE(SUM(
      CASE
        WHEN jel.credit_amount IS NOT NULL THEN jel.credit_amount
        WHEN jel.debit_amount IS NOT NULL THEN -jel.debit_amount
        ELSE 0
      END
    ), 0)
    INTO v_balance
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    LEFT JOIN transactions t ON t.journal_entry_id = je.id
    WHERE jel.account_id = p_account_id
      AND (t.id IS NULL OR t.status = 'posted');
  END IF;

  RETURN v_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix update_account_balance_from_journal function
CREATE OR REPLACE FUNCTION update_account_balance_from_journal()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE user_chart_of_accounts
    SET current_balance = recalculate_account_balance(OLD.account_id)
    WHERE id = OLD.account_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.account_id != NEW.account_id THEN
      UPDATE user_chart_of_accounts
      SET current_balance = recalculate_account_balance(OLD.account_id)
      WHERE id = OLD.account_id;
    END IF;
    UPDATE user_chart_of_accounts
    SET current_balance = recalculate_account_balance(NEW.account_id)
    WHERE id = NEW.account_id;
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    UPDATE user_chart_of_accounts
    SET current_balance = recalculate_account_balance(NEW.account_id)
    WHERE id = NEW.account_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fix update_balance_on_transaction_status_change function
CREATE OR REPLACE FUNCTION update_balance_on_transaction_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.journal_entry_id IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status THEN
    UPDATE user_chart_of_accounts
    SET current_balance = recalculate_account_balance(user_chart_of_accounts.id)
    WHERE id IN (
      SELECT DISTINCT account_id
      FROM journal_entry_lines
      WHERE journal_entry_id = NEW.journal_entry_id
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
