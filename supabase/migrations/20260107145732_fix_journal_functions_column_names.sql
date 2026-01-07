/*
  # Fix Journal Entry Functions Column Name References

  ## Problem
  Multiple journal entry functions reference non-existent columns:
  - `account_name` - this column never existed
  - `custom_display_name` - was renamed to `display_name` in migration 20251224235801

  The actual column in user_chart_of_accounts is: `display_name`

  ## Affected Functions
  1. `get_journal_entry_with_lines` - line 211 references ucoa.account_name
  2. `get_account_journal_lines` - line 274 and 325 reference account_name

  ## Fix
  Drop and recreate all affected functions with correct column references.
  Use `display_name` with fallback to template display_name for account names.

  ## Impact
  - Fixes "column account_name does not exist" errors
  - Allows journal entries to be viewed and displayed correctly
  - Enables opening balance journal entries to work end-to-end
*/

-- ============================================================================
-- Fix get_journal_entry_with_lines Function
-- ============================================================================

DROP FUNCTION IF EXISTS get_journal_entry_with_lines(uuid);

CREATE OR REPLACE FUNCTION get_journal_entry_with_lines(p_entry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', je.id,
    'profile_id', je.profile_id,
    'user_id', je.user_id,
    'entry_date', je.entry_date,
    'entry_number', je.entry_number,
    'description', je.description,
    'entry_type', je.entry_type,
    'source', je.source,
    'created_at', je.created_at,
    'updated_at', je.updated_at,
    'lines', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', jel.id,
          'line_number', jel.line_number,
          'account_id', jel.account_id,
          'account_number', ucoa.account_number,
          'account_name', COALESCE(ucoa.display_name, t.display_name),
          'debit_amount', jel.debit_amount,
          'credit_amount', jel.credit_amount,
          'description', jel.description
        ) ORDER BY jel.line_number
      )
      FROM journal_entry_lines jel
      JOIN user_chart_of_accounts ucoa ON jel.account_id = ucoa.id
      LEFT JOIN chart_of_accounts_templates t ON ucoa.template_account_number = t.account_number
      WHERE jel.journal_entry_id = je.id
    ),
    'total_debits', (
      SELECT COALESCE(SUM(debit_amount), 0)
      FROM journal_entry_lines WHERE journal_entry_id = je.id
    ),
    'total_credits', (
      SELECT COALESCE(SUM(credit_amount), 0)
      FROM journal_entry_lines WHERE journal_entry_id = je.id
    )
  ) INTO v_result
  FROM journal_entries je
  WHERE je.id = p_entry_id;
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_journal_entry_with_lines IS
'Returns complete journal entry with all lines and account details. Uses display_name from user accounts with fallback to template.';

-- ============================================================================
-- Fix get_account_journal_lines Function
-- ============================================================================

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
  transaction_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    jel.id, je.id, je.entry_number, je.entry_date,
    je.description, jel.description,
    jel.debit_amount, jel.credit_amount,
    (
      SELECT string_agg(
        COALESCE(ucoa2.display_name, t2.display_name), ', '
      )
      FROM journal_entry_lines jel2
      JOIN user_chart_of_accounts ucoa2 ON jel2.account_id = ucoa2.id
      LEFT JOIN chart_of_accounts_templates t2 ON ucoa2.template_account_number = t2.account_number
      WHERE jel2.journal_entry_id = je.id AND jel2.account_id != p_account_id
    ),
    COALESCE(t.status, 'posted')
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.journal_entry_id = je.id
  LEFT JOIN transactions t ON t.journal_entry_id = je.id
  WHERE jel.profile_id = p_profile_id
  AND jel.account_id = p_account_id
  AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
  AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
  ORDER BY je.entry_date, je.entry_number, jel.line_number;
END;
$$;

COMMENT ON FUNCTION get_account_journal_lines IS
'Returns all journal lines for an account with transaction status. Uses display_name with fallback to template. Lines only affect balance if transaction_status = posted or NULL (manual entry).';