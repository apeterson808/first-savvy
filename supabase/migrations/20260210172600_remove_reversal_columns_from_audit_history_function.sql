/*
  # Remove reversal columns from audit history function

  1. Changes
    - Dropped and recreated `get_account_audit_history_paginated` to remove
      reversal columns from the return type
    - Removed `is_reversed`, `is_reversal`, `reversed_by_entry_number`, 
      `reverses_entry_number` from RETURNS TABLE signature
    - These columns referenced a reversal system that was replaced with
      direct journal entry editing

  2. Context
    - The undo/reversal system was fully removed in prior migrations
    - The function was still returning these columns as constant false/NULL
    - This cleanup aligns the function signature with the current architecture
*/

DROP FUNCTION IF EXISTS public.get_account_audit_history_paginated(uuid, uuid, date, date, integer, integer);

CREATE OR REPLACE FUNCTION public.get_account_audit_history_paginated(
  p_profile_id uuid,
  p_account_id uuid,
  p_start_date date DEFAULT NULL::date,
  p_end_date date DEFAULT NULL::date,
  p_limit integer DEFAULT 100,
  p_offset integer DEFAULT 0
)
RETURNS TABLE(
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
  created_at timestamp with time zone,
  running_balance numeric,
  total_count bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  LEFT JOIN transactions t ON t.current_journal_entry_id = je.id AND t.bank_account_id = p_account_id
  WHERE jel.profile_id = p_profile_id
    AND jel.account_id = p_account_id
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
      CASE
        WHEN v_account_class IN ('asset', 'expense') THEN
          COALESCE(jel.debit_amount, 0) - COALESCE(jel.credit_amount, 0)
        ELSE
          COALESCE(jel.credit_amount, 0) - COALESCE(jel.debit_amount, 0)
      END as bl_net_change,
      jel.line_number as bl_line_number
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    LEFT JOIN offsetting_accounts_agg oaa ON oaa.journal_entry_id = je.id
    LEFT JOIN transactions t ON t.current_journal_entry_id = je.id AND t.bank_account_id = p_account_id
    LEFT JOIN user_chart_of_accounts ucoa_current ON ucoa_current.id = p_account_id
    LEFT JOIN chart_of_accounts_templates t_current ON ucoa_current.template_account_number = t_current.account_number
    WHERE jel.profile_id = p_profile_id
      AND jel.account_id = p_account_id
      AND (p_start_date IS NULL OR COALESCE(t.date, je.entry_date) >= p_start_date)
      AND (p_end_date IS NULL OR COALESCE(t.date, je.entry_date) <= p_end_date)
  ),
  lines_with_balance AS (
    SELECT
      bl.bl_line_id,
      bl.bl_entry_id,
      bl.bl_entry_number,
      bl.bl_entry_type,
      bl.bl_entry_date,
      bl.bl_transaction_date,
      bl.bl_entry_description,
      bl.bl_line_description,
      bl.bl_debit_amount,
      bl.bl_credit_amount,
      bl.bl_offsetting_accounts,
      bl.bl_transaction_id,
      bl.bl_transaction_status,
      bl.bl_cleared_status,
      bl.bl_created_at,
      SUM(bl.bl_net_change) OVER (
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
    v_total_count
  FROM lines_with_balance lwb
  ORDER BY lwb.bl_transaction_date DESC, lwb.bl_entry_number DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;
