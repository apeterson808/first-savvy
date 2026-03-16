/*
  # Add Multi-Account Audit History Function

  1. New Function
    - `get_multi_account_audit_history_paginated` - Gets audit history for parent and child accounts
    - Accepts array of account IDs to query multiple accounts at once
    - Includes account name to distinguish between parent and child transactions
    - Returns same structure as single-account function plus account information

  2. Purpose
    - Allow parent budget accounts to show audit history from both parent and all child accounts
    - Add account column to distinguish which account each transaction belongs to
    - Maintain proper running balance calculations per account
*/

CREATE OR REPLACE FUNCTION get_multi_account_audit_history_paginated(
  p_profile_id uuid,
  p_account_ids uuid[],
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL,
  p_limit int DEFAULT 100,
  p_offset int DEFAULT 0
)
RETURNS TABLE (
  line_id uuid,
  entry_id uuid,
  entry_number text,
  entry_type text,
  entry_date date,
  transaction_date date,
  entry_description text,
  line_description text,
  debit_amount numeric,
  credit_amount numeric,
  offsetting_accounts text,
  transaction_id uuid,
  transaction_status text,
  cleared_status text,
  created_at timestamptz,
  running_balance numeric,
  total_count bigint,
  account_id uuid,
  account_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
v_total_count bigint;
BEGIN
  SELECT COUNT(*) INTO v_total_count
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.journal_entry_id = je.id
  LEFT JOIN transactions t ON t.current_journal_entry_id = je.id
  WHERE jel.profile_id = p_profile_id
    AND jel.account_id = ANY(p_account_ids)
    AND (p_start_date IS NULL OR COALESCE(t.date, je.entry_date) >= p_start_date)
    AND (p_end_date IS NULL OR COALESCE(t.date, je.entry_date) <= p_end_date);

  RETURN QUERY
  WITH offsetting_accounts_agg AS (
    SELECT
      jel2.journal_entry_id,
      string_agg(
        COALESCE(ucoa2.display_name, t2.display_name),
        ', '
        ORDER BY ucoa2.account_number
      ) as all_accounts_list
    FROM journal_entry_lines jel2
    JOIN user_chart_of_accounts ucoa2 ON jel2.account_id = ucoa2.id
    LEFT JOIN chart_of_accounts_templates t2 ON ucoa2.template_account_number = t2.account_number
    WHERE jel2.profile_id = p_profile_id
    GROUP BY jel2.journal_entry_id
  ),
  base_lines AS (
    SELECT
      jel.id as bl_line_id,
      je.id as bl_entry_id,
      je.entry_number as bl_entry_number,
      je.entry_type as bl_entry_type,
      je.entry_date as bl_entry_date,
      COALESCE(t.date, je.entry_date) as bl_transaction_date,
      je.description as bl_entry_description,
      jel.description as bl_line_description,
      jel.debit_amount as bl_debit_amount,
      jel.credit_amount as bl_credit_amount,
      CASE
        WHEN oaa.all_accounts_list IS NOT NULL THEN
          TRIM(BOTH ', ' FROM
            REPLACE(
              ', ' || oaa.all_accounts_list || ', ',
              ', ' || COALESCE(ucoa_current.display_name, t_current.display_name) || ', ',
              ', '
            )
          )
        ELSE NULL
      END as bl_offsetting_accounts,
      t.id as bl_transaction_id,
      COALESCE(t.status, 'posted')::text as bl_transaction_status,
      COALESCE(t.cleared_status, 'uncleared')::text as bl_cleared_status,
      je.created_at as bl_created_at,
      jel.account_id as bl_account_id,
      COALESCE(ucoa_current.display_name, t_current.display_name) as bl_account_name,
      ucoa_current.class as bl_account_class,
      CASE
        WHEN ucoa_current.class IN ('asset', 'expense') THEN
          COALESCE(jel.debit_amount, 0) - COALESCE(jel.credit_amount, 0)
        ELSE
          COALESCE(jel.credit_amount, 0) - COALESCE(jel.debit_amount, 0)
      END as bl_net_change,
      jel.line_number as bl_line_number
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    JOIN user_chart_of_accounts ucoa_current ON jel.account_id = ucoa_current.id
    LEFT JOIN chart_of_accounts_templates t_current ON ucoa_current.template_account_number = t_current.account_number
    LEFT JOIN offsetting_accounts_agg oaa ON oaa.journal_entry_id = je.id
    LEFT JOIN transactions t ON t.current_journal_entry_id = je.id
    WHERE jel.profile_id = p_profile_id
      AND jel.account_id = ANY(p_account_ids)
      AND (p_start_date IS NULL OR COALESCE(t.date, je.entry_date) >= p_start_date)
      AND (p_end_date IS NULL OR COALESCE(t.date, je.entry_date) <= p_end_date)
  ),
  lines_with_balance AS (
    SELECT
      bl.*,
      SUM(bl.bl_net_change) OVER (
        PARTITION BY bl.bl_account_id
        ORDER BY bl.bl_transaction_date, bl.bl_entry_number, bl.bl_line_number
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) as lwb_running_balance
    FROM base_lines bl
  )
  SELECT
    lwb.bl_line_id,
    lwb.bl_entry_id,
    lwb.bl_entry_number,
    lwb.bl_entry_type,
    lwb.bl_entry_date,
    lwb.bl_transaction_date,
    lwb.bl_entry_description,
    lwb.bl_line_description,
    lwb.bl_debit_amount,
    lwb.bl_credit_amount,
    lwb.bl_offsetting_accounts,
    lwb.bl_transaction_id,
    lwb.bl_transaction_status,
    lwb.bl_cleared_status,
    lwb.bl_created_at,
    lwb.lwb_running_balance,
    v_total_count,
    lwb.bl_account_id,
    lwb.bl_account_name
  FROM lines_with_balance lwb
  ORDER BY lwb.bl_transaction_date DESC, lwb.bl_entry_number DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;