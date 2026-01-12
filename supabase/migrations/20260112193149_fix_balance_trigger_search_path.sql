/*
  # Fix Balance Update Trigger Search Path

  1. Issue
    - update_balance_on_transaction_status_change function missing search_path
    - Causes "relation does not exist" errors

  2. Changes
    - Add SET search_path = public to function
    - Prevents schema resolution issues
*/

CREATE OR REPLACE FUNCTION update_balance_on_transaction_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- When a transaction's journal entry is linked, update all affected account balances
  IF (TG_OP = 'UPDATE' AND OLD.journal_entry_id IS NULL AND NEW.journal_entry_id IS NOT NULL) OR
     (TG_OP = 'UPDATE' AND OLD.journal_entry_id IS NOT NULL AND NEW.journal_entry_id IS NULL) THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;