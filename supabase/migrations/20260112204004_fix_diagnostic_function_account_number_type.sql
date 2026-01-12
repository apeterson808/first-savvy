/*
  # Fix Diagnostic Function Type Mismatch

  1. Changes
    - Cast account_number to text to match return type declaration
    - This fixes the "Returned type integer does not match expected type text" error
*/

CREATE OR REPLACE FUNCTION diagnose_account_journal_lines(
  p_account_id uuid
)
RETURNS TABLE (
  line_id uuid,
  journal_entry_id uuid,
  entry_number text,
  entry_date date,
  entry_type text,
  source text,
  entry_description text,
  line_description text,
  debit_amount numeric,
  credit_amount numeric,
  profile_id uuid,
  account_number text,
  account_name text,
  transaction_id uuid,
  transaction_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    jel.id as line_id,
    jel.journal_entry_id,
    je.entry_number,
    je.entry_date,
    je.entry_type,
    je.source,
    je.description as entry_description,
    jel.description as line_description,
    jel.debit_amount,
    jel.credit_amount,
    jel.profile_id,
    ucoa.account_number::text,
    ucoa.display_name as account_name,
    t.id as transaction_id,
    t.status as transaction_status
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.journal_entry_id = je.id
  JOIN user_chart_of_accounts ucoa ON jel.account_id = ucoa.id
  LEFT JOIN transactions t ON t.journal_entry_id = je.id
  WHERE jel.account_id = p_account_id
  ORDER BY je.entry_date, je.entry_number, jel.line_number;
END;
$$;
