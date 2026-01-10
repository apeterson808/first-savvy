/*
  # Fix Account Register to Show Only Posted Transactions

  ## Problem
  The `get_account_journal_lines` function was returning ALL journal entries including
  those linked to pending transactions. This caused the account register to show only
  opening balance entries because pending transactions weren't meant to be displayed.

  ## Solution
  - Add WHERE clause to filter: only show lines where transaction status is 'posted' or NULL (manual entries)
  - Add cleared_status to return fields for reconciliation display
  - This ensures the register shows the complete transaction history

  ## Changes
  1. Update return type to include cleared_status
  2. Add filter: (t.id IS NULL OR t.status = 'posted')
  3. Return t.cleared_status with default 'uncleared' for manual entries

  ## Impact
  - Account registers will now show all posted transactions
  - Pending transactions remain hidden (as intended)
  - Manual journal entries appear (as intended)
  - Cleared status available for reconciliation workflow
*/

DROP FUNCTION IF EXISTS get_account_journal_lines(uuid, uuid, date, date);

CREATE OR REPLACE FUNCTION get_account_journal_lines(
  p_profile_id uuid,
  p_account_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
)
RETURNS TABLE (
  line_id uuid,
  entry_id uuid,
  entry_number text,
  entry_date date,
  entry_description text,
  line_description text,
  debit_amount numeric,
  credit_amount numeric,
  offsetting_accounts text,
  transaction_status text,
  cleared_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    jel.id,
    je.id,
    je.entry_number,
    je.entry_date,
    je.description,
    jel.description,
    jel.debit_amount,
    jel.credit_amount,
    (
      SELECT string_agg(
        COALESCE(ucoa2.display_name, t2.display_name), ', '
      )
      FROM journal_entry_lines jel2
      JOIN user_chart_of_accounts ucoa2 ON jel2.account_id = ucoa2.id
      LEFT JOIN chart_of_accounts_templates t2 ON ucoa2.template_account_number = t2.account_number
      WHERE jel2.journal_entry_id = je.id AND jel2.account_id != p_account_id
    ),
    COALESCE(t.status, 'posted')::text,
    COALESCE(t.cleared_status, 'uncleared')::text
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.journal_entry_id = je.id
  LEFT JOIN transactions t ON t.journal_entry_id = je.id
  WHERE jel.profile_id = p_profile_id
  AND jel.account_id = p_account_id
  AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
  AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
  AND (t.id IS NULL OR t.status = 'posted')
  ORDER BY je.entry_date, je.entry_number, jel.line_number;
END;
$$;

COMMENT ON FUNCTION get_account_journal_lines IS
'Returns all journal lines for an account. Only includes posted transactions and manual journal entries. Pending transactions are filtered out. Includes cleared_status for reconciliation workflow.';
