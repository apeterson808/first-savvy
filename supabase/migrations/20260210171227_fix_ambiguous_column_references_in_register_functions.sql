/*
  # Fix broken account register functions

  1. Fixes
    - `get_account_journal_lines_paginated`: Fixed ambiguous column references
      between RETURNS TABLE variables and CTE column aliases (line_id, entry_id, etc.)
    - `get_account_journal_lines`: Fixed ambiguous column reference for entry_id
      in relevant_entries CTE conflicting with RETURNS TABLE variable
    - `get_account_audit_history_paginated`: Removed references to non-existent
      columns (reversed_by_entry_id, reverses_entry_id) on journal_entries table

  2. Root Cause
    - PL/pgSQL RETURNS TABLE columns create implicit variables in the function
      body. When CTEs use the same column names, PostgreSQL cannot resolve the
      ambiguity and throws an error.
    - The audit history function referenced columns that were removed in a prior
      migration that simplified the reversal system.

  3. Impact
    - All three functions were returning errors on every call, causing the account
      register and audit history tabs to silently show "No activity found"
*/

-- Fix 1: get_account_journal_lines_paginated
-- Add table-qualified aliases (bl., lwb.) to disambiguate CTE columns from RETURNS TABLE variables
CREATE OR REPLACE FUNCTION public.get_account_journal_lines_paginated(
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
      jel.id as bl_line_id,
      je.id as bl_entry_id,
      je.entry_number as bl_entry_number,
      je.entry_date as bl_entry_date,
      je.description as bl_entry_description,
      jel.description as bl_line_description,
      jel.debit_amount as bl_debit_amount,
      jel.credit_amount as bl_credit_amount,
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
      END as bl_offsetting_accounts,
      COALESCE(t.status, 'posted')::text as bl_transaction_status,
      COALESCE(t.cleared_status, 'uncleared')::text as bl_cleared_status,
      t.id as bl_transaction_id,
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
      bl.bl_line_id,
      bl.bl_entry_id,
      bl.bl_entry_number,
      bl.bl_entry_date,
      bl.bl_entry_description,
      bl.bl_line_description,
      bl.bl_debit_amount,
      bl.bl_credit_amount,
      bl.bl_offsetting_accounts,
      bl.bl_transaction_status,
      bl.bl_cleared_status,
      bl.bl_transaction_id,
      SUM(bl.bl_net_change) OVER (
        ORDER BY bl.bl_entry_date, bl.bl_entry_number, bl.bl_line_number
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) as lwb_running_balance
    FROM base_lines bl
  )
  SELECT
    lwb.bl_line_id,
    lwb.bl_entry_id,
    lwb.bl_entry_number,
    lwb.bl_entry_date,
    lwb.bl_entry_description,
    lwb.bl_line_description,
    lwb.bl_debit_amount,
    lwb.bl_credit_amount,
    lwb.bl_offsetting_accounts,
    lwb.bl_transaction_status,
    lwb.bl_cleared_status,
    lwb.lwb_running_balance,
    v_total_count,
    lwb.bl_transaction_id
  FROM lines_with_balance lwb
  ORDER BY lwb.bl_entry_date DESC, lwb.bl_entry_number DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;


-- Fix 2: get_account_journal_lines
-- Rename CTE column aliases to avoid conflict with RETURNS TABLE variables
CREATE OR REPLACE FUNCTION public.get_account_journal_lines(
  p_profile_id uuid,
  p_account_id uuid,
  p_start_date date DEFAULT NULL::date,
  p_end_date date DEFAULT NULL::date
)
RETURNS TABLE(
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
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  WITH relevant_entries AS (
    SELECT DISTINCT je.id as re_je_id
    FROM journal_entries je
    JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
    LEFT JOIN transactions t ON t.journal_entry_id = je.id
    WHERE jel.profile_id = p_profile_id
      AND jel.account_id = p_account_id
      AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
      AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
      AND (t.id IS NULL OR t.status = 'posted')
  ),
  offsetting_accounts_agg AS (
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
      AND jel2.journal_entry_id IN (SELECT re_je_id FROM relevant_entries)
    GROUP BY jel2.journal_entry_id, jel2.account_id
  )
  SELECT
    jel.id,
    je.id,
    je.entry_number,
    je.entry_date,
    je.description,
    jel.description,
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
    END,
    COALESCE(t.status, 'posted')::text,
    COALESCE(t.cleared_status, 'uncleared')::text
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.journal_entry_id = je.id
  LEFT JOIN offsetting_accounts_agg oaa ON oaa.journal_entry_id = je.id
  LEFT JOIN transactions t ON t.journal_entry_id = je.id
  LEFT JOIN user_chart_of_accounts ucoa_current ON ucoa_current.id = p_account_id
  LEFT JOIN chart_of_accounts_templates t_current ON ucoa_current.template_account_number = t_current.account_number
  WHERE jel.profile_id = p_profile_id
    AND jel.account_id = p_account_id
    AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
    AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
    AND (t.id IS NULL OR t.status = 'posted')
  ORDER BY je.entry_date, je.entry_number, jel.line_number;
END;
$function$;


-- Fix 3: get_account_audit_history_paginated
-- Remove references to non-existent columns (reversed_by_entry_id, reverses_entry_id)
-- and the JOINs to look up reversal entry numbers
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
  is_reversed boolean,
  is_reversal boolean,
  reversed_by_entry_number text,
  reverses_entry_number text,
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
      false as bl_is_reversed,
      false as bl_is_reversal,
      NULL::text as bl_reversed_by_entry_number,
      NULL::text as bl_reverses_entry_number,
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
      bl.bl_is_reversed,
      bl.bl_is_reversal,
      bl.bl_reversed_by_entry_number,
      bl.bl_reverses_entry_number,
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
    lwb.bl_is_reversed,
    lwb.bl_is_reversal,
    lwb.bl_reversed_by_entry_number,
    lwb.bl_reverses_entry_number,
    lwb.bl_created_at,
    lwb.lwb_running_balance,
    v_total_count
  FROM lines_with_balance lwb
  ORDER BY lwb.bl_transaction_date DESC, lwb.bl_entry_number DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$function$;
