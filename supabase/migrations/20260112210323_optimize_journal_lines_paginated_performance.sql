/*
  # Optimize Journal Lines Paginated Function Performance

  1. Problem
    - Function has unnecessary LEFT JOINs to chart_of_accounts_templates
    - Complex nested CTEs that may not optimize well
    - String aggregation could be simplified
    - Even with small datasets (4 lines), users report slowness

  2. Optimizations
    - Use display_name directly from user_chart_of_accounts (already populated)
    - Simplify CTE structure
    - Reduce number of JOINs
    - Use materialized CTEs where beneficial
*/

DROP FUNCTION IF EXISTS get_account_journal_lines_paginated(uuid, uuid, date, date, integer, integer);

CREATE OR REPLACE FUNCTION get_account_journal_lines_paginated(
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
  entry_type text,
  source text,
  entry_description text,
  line_description text,
  debit_amount numeric,
  credit_amount numeric,
  offsetting_accounts text,
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
  v_current_account_name text;
  v_total_count bigint;
BEGIN
  -- Get the account class and name in one query
  SELECT class, display_name 
  INTO v_account_class, v_current_account_name
  FROM user_chart_of_accounts
  WHERE id = p_account_id;

  -- Calculate total count for pagination metadata
  SELECT COUNT(*) INTO v_total_count
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.journal_entry_id = je.id
  WHERE jel.profile_id = p_profile_id
  AND jel.account_id = p_account_id
  AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
  AND (p_end_date IS NULL OR je.entry_date <= p_end_date);

  RETURN QUERY
  WITH base_data AS (
    -- Get all the data we need in one pass
    SELECT
      jel.id,
      jel.journal_entry_id,
      jel.account_id,
      jel.line_number,
      jel.description as line_desc,
      jel.debit_amount,
      jel.credit_amount,
      je.id as journal_id,
      je.entry_number as journal_number,
      je.entry_date,
      je.entry_type as j_entry_type,
      je.source as j_source,
      je.description as entry_desc,
      t.status as t_status,
      t.cleared_status as t_cleared_status,
      -- Calculate net change for running balance
      CASE
        WHEN v_account_class IN ('asset', 'expense') THEN
          COALESCE(jel.debit_amount, 0) - COALESCE(jel.credit_amount, 0)
        ELSE
          COALESCE(jel.credit_amount, 0) - COALESCE(jel.debit_amount, 0)
      END as net_change
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    LEFT JOIN transactions t ON t.journal_entry_id = je.id
    WHERE jel.profile_id = p_profile_id
    AND jel.account_id = p_account_id
    AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
    AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
  ),
  offsetting_accounts_agg AS (
    -- Get offsetting accounts for relevant journal entries only
    SELECT
      jel2.journal_entry_id,
      string_agg(
        ucoa2.display_name,
        ', '
        ORDER BY ucoa2.account_number
      ) as accounts_list
    FROM journal_entry_lines jel2
    JOIN user_chart_of_accounts ucoa2 ON jel2.account_id = ucoa2.id
    WHERE jel2.profile_id = p_profile_id
    AND jel2.journal_entry_id IN (SELECT DISTINCT journal_entry_id FROM base_data)
    GROUP BY jel2.journal_entry_id
  ),
  lines_with_balance AS (
    SELECT
      bd.id,
      bd.journal_id,
      bd.journal_number,
      bd.entry_date,
      bd.j_entry_type,
      bd.j_source,
      bd.entry_desc,
      bd.line_desc,
      bd.debit_amount,
      bd.credit_amount,
      -- Remove current account from offsetting accounts list
      CASE
        WHEN oaa.accounts_list IS NOT NULL THEN
          TRIM(BOTH ', ' FROM
            REPLACE(', ' || oaa.accounts_list || ', ', ', ' || v_current_account_name || ', ', ', ')
          )
        ELSE NULL
      END as offsetting_accts,
      COALESCE(bd.t_status, 'posted')::text as txn_status,
      COALESCE(bd.t_cleared_status, 'uncleared')::text as cleared_stat,
      -- Running balance
      SUM(bd.net_change) OVER (
        ORDER BY bd.entry_date, bd.journal_number, bd.line_number
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) as balance
    FROM base_data bd
    LEFT JOIN offsetting_accounts_agg oaa ON oaa.journal_entry_id = bd.journal_entry_id
  )
  SELECT
    lwb.id,
    lwb.journal_id,
    lwb.journal_number,
    lwb.entry_date,
    lwb.j_entry_type,
    lwb.j_source,
    lwb.entry_desc,
    lwb.line_desc,
    lwb.debit_amount,
    lwb.credit_amount,
    lwb.offsetting_accts,
    lwb.txn_status,
    lwb.cleared_stat,
    lwb.balance,
    v_total_count
  FROM lines_with_balance lwb
  ORDER BY lwb.entry_date, lwb.journal_number
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION get_account_journal_lines_paginated IS
'Optimized paginated version with running balance. Reduced JOINs and simplified CTEs for better performance.';
