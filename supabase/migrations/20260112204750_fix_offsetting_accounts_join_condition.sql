/*
  # Fix Offsetting Accounts Join Condition

  1. Problem
    - The join `AND oaa.line_account_id = jel.account_id` filters to only the current account
    - This causes the offsetting accounts to be empty or incorrect
    - The REPLACE logic on lines 119-123 already handles excluding the current account

  2. Solution
    - Remove the `AND oaa.line_account_id = jel.account_id` condition
    - Join only on journal_entry_id to get all accounts in the entry
    - Let the REPLACE logic filter out the current account from the list
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
  WHERE jel.profile_id = p_profile_id
  AND jel.account_id = p_account_id
  AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
  AND (p_end_date IS NULL OR je.entry_date <= p_end_date);

  RETURN QUERY
  WITH relevant_entries AS (
    -- First identify which journal entries we need (CRITICAL for performance)
    SELECT DISTINCT je.id as journal_entry_id
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    WHERE jel.profile_id = p_profile_id
    AND jel.account_id = p_account_id
    AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
    AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
  ),
  offsetting_accounts_agg AS (
    -- Only aggregate for the journal entries we actually need
    SELECT
      jel2.journal_entry_id,
      string_agg(
        COALESCE(ucoa2.display_name, t2.display_name),
        ', '
        ORDER BY ucoa2.account_number
      ) as offsetting_accounts_list
    FROM journal_entry_lines jel2
    JOIN user_chart_of_accounts ucoa2 ON jel2.account_id = ucoa2.id
    LEFT JOIN chart_of_accounts_templates t2 ON ucoa2.template_account_number = t2.account_number
    WHERE jel2.profile_id = p_profile_id
    AND jel2.journal_entry_id IN (SELECT journal_entry_id FROM relevant_entries)
    GROUP BY jel2.journal_entry_id
  ),
  base_lines AS (
    SELECT
      jel.id as line_id,
      je.id as entry_id,
      je.entry_number,
      je.entry_date,
      je.entry_type,
      je.source,
      je.description as entry_description,
      jel.description as line_description,
      jel.debit_amount,
      jel.credit_amount,
      -- Get offsetting accounts from the pre-aggregated CTE, excluding current account
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
      -- Calculate the net effect on this account for running balance
      CASE
        -- For asset, expense accounts: debits increase, credits decrease
        WHEN v_account_class IN ('asset', 'expense') THEN
          COALESCE(jel.debit_amount, 0) - COALESCE(jel.credit_amount, 0)
        -- For liability, equity, income accounts: credits increase, debits decrease
        ELSE
          COALESCE(jel.credit_amount, 0) - COALESCE(jel.debit_amount, 0)
      END as net_change,
      jel.line_number
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    JOIN relevant_entries re ON re.journal_entry_id = je.id
    LEFT JOIN offsetting_accounts_agg oaa ON oaa.journal_entry_id = je.id
    LEFT JOIN transactions t ON t.journal_entry_id = je.id
    LEFT JOIN user_chart_of_accounts ucoa_current ON ucoa_current.id = p_account_id
    LEFT JOIN chart_of_accounts_templates t_current ON ucoa_current.template_account_number = t_current.account_number
    WHERE jel.profile_id = p_profile_id
    AND jel.account_id = p_account_id
  ),
  lines_with_balance AS (
    SELECT
      line_id,
      entry_id,
      entry_number,
      entry_date,
      entry_type,
      source,
      entry_description,
      line_description,
      debit_amount,
      credit_amount,
      offsetting_accounts,
      transaction_status,
      cleared_status,
      -- Calculate running balance using window function
      SUM(net_change) OVER (
        ORDER BY entry_date, entry_number, line_number
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) as running_balance
    FROM base_lines
  )
  SELECT
    lwb.line_id,
    lwb.entry_id,
    lwb.entry_number,
    lwb.entry_date,
    lwb.entry_type,
    lwb.source,
    lwb.entry_description,
    lwb.line_description,
    lwb.debit_amount,
    lwb.credit_amount,
    lwb.offsetting_accounts,
    lwb.transaction_status,
    lwb.cleared_status,
    lwb.running_balance,
    v_total_count as total_count
  FROM lines_with_balance lwb
  ORDER BY lwb.entry_date, lwb.entry_number
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION get_account_journal_lines_paginated IS
'Paginated version with running balance calculation. Returns ALL journal lines for an account (no transaction status filtering). Journal entries are the source of truth. Fixed offsetting accounts join condition to properly exclude current account.';
