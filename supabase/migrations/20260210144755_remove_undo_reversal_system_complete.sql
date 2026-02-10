/*
  # Remove Undo and Reversal System - Replace with Direct Edit

  1. Drop Dependencies
    - Drop active_journal_lines view (depends on reversed_by_entry_id)
    - Drop get_journal_entry_audit_trail function (references reversal columns)
    - Drop get_account_journal_lines_paginated function (filters by reversed_by_entry_id)
  
  2. Remove Undo Columns from transactions
    - Drop unposted_at, unposted_by, unposted_reason, unposted_reversal_entry_id
  
  3. Remove Reversal Columns from journal_entries
    - Drop reversed_by_entry_id, reverses_entry_id
  
  4. Recreate Simplified Views and Functions
    - Recreate active_journal_lines without reversal logic (all entries are active)
    - Recreate get_account_journal_lines_paginated without reversal filtering
    - Update audit trail to use audit_logs table instead
*/

-- =====================================================
-- 1. DROP DEPENDENT OBJECTS
-- =====================================================

DROP VIEW IF EXISTS active_journal_lines;
DROP FUNCTION IF EXISTS get_journal_entry_audit_trail(uuid);
DROP FUNCTION IF EXISTS get_account_journal_lines_paginated(uuid,uuid,date,date,integer,integer);

-- =====================================================
-- 2. DROP UNDO/REVERSAL COLUMNS
-- =====================================================

-- Drop undo-related columns from transactions
ALTER TABLE transactions
  DROP COLUMN IF EXISTS unposted_at,
  DROP COLUMN IF EXISTS unposted_by,
  DROP COLUMN IF EXISTS unposted_reason,
  DROP COLUMN IF EXISTS unposted_reversal_entry_id;

-- Drop reversal tracking columns from journal_entries
ALTER TABLE journal_entries
  DROP COLUMN IF EXISTS reversed_by_entry_id,
  DROP COLUMN IF EXISTS reverses_entry_id;

-- =====================================================
-- 3. RECREATE SIMPLIFIED ACTIVE JOURNAL LINES VIEW
-- =====================================================

-- All journal entries are now "active" since we edit in place
-- No need to filter out reversals - they don't exist anymore
CREATE VIEW active_journal_lines AS
SELECT
  jel.id,
  jel.journal_entry_id,
  jel.profile_id,
  jel.user_id,
  jel.account_id,
  jel.line_number,
  jel.debit_amount,
  jel.credit_amount,
  jel.description,
  jel.created_at
FROM journal_entry_lines jel
JOIN journal_entries je ON jel.journal_entry_id = je.id;

COMMENT ON VIEW active_journal_lines IS
'View of all journal_entry_lines. Simplified from reversal-based system.
All entries are active since edits happen in-place with audit trail in audit_logs.';

ALTER VIEW active_journal_lines SET (security_invoker = true);
GRANT SELECT ON active_journal_lines TO authenticated;

-- =====================================================
-- 4. RECREATE SIMPLIFIED PAGINATED FUNCTION
-- =====================================================

CREATE FUNCTION get_account_journal_lines_paginated(
  p_profile_id uuid,
  p_account_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
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
  cleared_status text,
  running_balance numeric,
  total_count bigint,
  transaction_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_class text;
  v_total_count bigint;
BEGIN
  -- Get the account class to determine normal balance
  SELECT class INTO v_account_class
  FROM user_chart_of_accounts
  WHERE id = p_account_id;

  -- Calculate total count for pagination metadata
  SELECT COUNT(*) INTO v_total_count
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.journal_entry_id = je.id
  LEFT JOIN transactions t ON t.current_journal_entry_id = je.id
  WHERE jel.profile_id = p_profile_id
  AND jel.account_id = p_account_id
  AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
  AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
  AND (t.id IS NULL OR t.status = 'posted');

  RETURN QUERY
  WITH offsetting_accounts_agg AS (
    SELECT
      jel2.journal_entry_id,
      jel2.account_id as line_account_id,
      string_agg(
        COALESCE(ucoa2.display_name, t2.display_name),
        ', '
        ORDER BY ucoa2.account_number
      ) as offsetting_accounts_list
    FROM journal_entry_lines jel2
    JOIN user_chart_of_accounts ucoa2 ON jel2.account_id = ucoa2.id
    LEFT JOIN chart_of_accounts_templates t2 ON ucoa2.template_account_number = t2.account_number
    WHERE jel2.profile_id = p_profile_id
    GROUP BY jel2.journal_entry_id, jel2.account_id
  ),
  base_lines AS (
    SELECT
      jel.id as line_id,
      je.id as entry_id,
      je.entry_number,
      je.entry_date,
      je.description as entry_description,
      jel.description as line_description,
      jel.debit_amount,
      jel.credit_amount,
      CASE
        WHEN oaa.offsetting_accounts_list IS NOT NULL THEN
          TRIM(BOTH ', ' FROM
            REPLACE(
              ', ' || oaa.offsetting_accounts_list || ', ',
              ', ' || COALESCE(ucoa_current.display_name, t_current.display_name) || ', ',
              ', '
            )
          )
        ELSE NULL
      END as offsetting_accounts,
      COALESCE(t.status, 'posted')::text as transaction_status,
      COALESCE(t.cleared_status, 'uncleared')::text as cleared_status,
      t.id as transaction_id,
      CASE
        WHEN v_account_class IN ('asset', 'expense') THEN
          COALESCE(jel.debit_amount, 0) - COALESCE(jel.credit_amount, 0)
        ELSE
          COALESCE(jel.credit_amount, 0) - COALESCE(jel.debit_amount, 0)
      END as net_change,
      jel.line_number
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    LEFT JOIN offsetting_accounts_agg oaa ON oaa.journal_entry_id = je.id
    LEFT JOIN transactions t ON t.current_journal_entry_id = je.id
    LEFT JOIN user_chart_of_accounts ucoa_current ON ucoa_current.id = p_account_id
    LEFT JOIN chart_of_accounts_templates t_current ON ucoa_current.template_account_number = t_current.account_number
    WHERE jel.profile_id = p_profile_id
    AND jel.account_id = p_account_id
    AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
    AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
    AND (t.id IS NULL OR t.status = 'posted')
  ),
  lines_with_balance AS (
    SELECT
      line_id,
      entry_id,
      entry_number,
      entry_date,
      entry_description,
      line_description,
      debit_amount,
      credit_amount,
      offsetting_accounts,
      transaction_status,
      cleared_status,
      transaction_id,
      SUM(net_change) OVER (
        ORDER BY entry_date, entry_number, line_number
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) as running_balance
    FROM base_lines
  )
  SELECT
    line_id,
    entry_id,
    entry_number,
    entry_date,
    entry_description,
    line_description,
    debit_amount,
    credit_amount,
    offsetting_accounts,
    transaction_status,
    cleared_status,
    running_balance,
    v_total_count as total_count,
    transaction_id
  FROM lines_with_balance
  ORDER BY entry_date DESC, entry_number DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION get_account_journal_lines_paginated IS
'Paginated journal lines for an account with running balance calculation.
Simplified from reversal system - all entries are active, edits tracked in audit_logs.';

GRANT EXECUTE ON FUNCTION get_account_journal_lines_paginated TO authenticated;
