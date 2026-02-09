/*
  # Fix duplicate rows in get_account_journal_lines_paginated

  ## Summary
  Fixes duplicate journal entry lines appearing in the account register.
  The issue was caused by an improper join with the offsetting_accounts_agg CTE.

  ## Problem
  The offsetting_accounts_agg was grouped by both journal_entry_id AND account_id,
  which created multiple rows per journal entry. When joined without filtering
  by account_id, this caused a cartesian product resulting in duplicate lines.

  ## Solution
  Add a join condition to match on the account_id, ensuring we only get one row
  per journal entry line in the base_lines CTE.

  ## Impact
  - Fixes the "Showing 26 of 13 transactions" bug
  - Each journal line will now appear exactly once
  - Correct transaction count display
*/

DROP FUNCTION IF EXISTS get_account_journal_lines_paginated(uuid,uuid,date,date,integer,integer);

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
  transaction_id uuid,
  transaction_status text,
  cleared_status text,
  running_balance numeric,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_class text;
  v_total_count bigint;
BEGIN
  SELECT class INTO v_account_class
  FROM user_chart_of_accounts
  WHERE id = p_account_id;

  SELECT COUNT(*) INTO v_total_count
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.journal_entry_id = je.id
  LEFT JOIN transactions t ON t.current_journal_entry_id = je.id
  WHERE jel.profile_id = p_profile_id
  AND jel.account_id = p_account_id
  AND je.reversed_by_entry_id IS NULL
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
      t.id as transaction_id,
      COALESCE(t.status, 'posted')::text as transaction_status,
      COALESCE(t.cleared_status, 'uncleared')::text as cleared_status,
      CASE
        WHEN v_account_class IN ('asset', 'expense') THEN
          COALESCE(jel.debit_amount, 0) - COALESCE(jel.credit_amount, 0)
        ELSE
          COALESCE(jel.credit_amount, 0) - COALESCE(jel.debit_amount, 0)
      END as net_change,
      jel.line_number
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    LEFT JOIN offsetting_accounts_agg oaa ON oaa.journal_entry_id = je.id AND oaa.line_account_id = jel.account_id
    LEFT JOIN transactions t ON t.current_journal_entry_id = je.id
    LEFT JOIN user_chart_of_accounts ucoa_current ON ucoa_current.id = p_account_id
    LEFT JOIN chart_of_accounts_templates t_current ON ucoa_current.template_account_number = t_current.account_number
    WHERE jel.profile_id = p_profile_id
    AND jel.account_id = p_account_id
    AND je.reversed_by_entry_id IS NULL
    AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
    AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
    AND (t.id IS NULL OR t.status = 'posted')
  ),
  lines_with_balance AS (
    SELECT
      bl.line_id,
      bl.entry_id,
      bl.entry_number,
      bl.entry_date,
      bl.entry_description,
      bl.line_description,
      bl.debit_amount,
      bl.credit_amount,
      bl.offsetting_accounts,
      bl.transaction_id,
      bl.transaction_status,
      bl.cleared_status,
      SUM(bl.net_change) OVER (
        ORDER BY bl.entry_date, bl.entry_number, bl.line_number
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) as running_balance
    FROM base_lines bl
  )
  SELECT
    lwb.line_id,
    lwb.entry_id,
    lwb.entry_number,
    lwb.entry_date,
    lwb.entry_description,
    lwb.line_description,
    lwb.debit_amount,
    lwb.credit_amount,
    lwb.offsetting_accounts,
    lwb.transaction_id,
    lwb.transaction_status,
    lwb.cleared_status,
    lwb.running_balance,
    v_total_count as total_count
  FROM lines_with_balance lwb
  ORDER BY lwb.entry_date DESC, lwb.entry_number DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION get_account_journal_lines_paginated IS
'Paginated version with running balance calculation. Returns journal lines for an account with pagination support.
Includes transaction_id to enable audit history lookups. NULL for manual journal entries.';
