/*
  # Add Actor Attribution to Audit History Functions

  ## Purpose
  The Audit History tab on bank accounts shows every journal entry but not who
  created it. Now that journal_entries has a created_by_user_id column (from the
  actor tracking migration), we can surface this in the audit view so households
  can see "Jenna" or "Andrew" next to each line.

  ## Changes
  1. Replace get_multi_account_audit_history_paginated to add actor_display_name
  2. Replace get_account_audit_history_paginated to add actor_display_name

  Both functions now return an additional column:
  - actor_display_name (text) — display_name from user_settings for whoever
    created the journal entry, or NULL for pre-existing entries
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
  account_name text,
  actor_display_name text
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
      jel.line_number as bl_line_number,
      COALESCE(
        NULLIF(TRIM(COALESCE(us.display_name, '')), ''),
        NULLIF(TRIM(COALESCE(us.first_name, '') || ' ' || COALESCE(us.last_name, '')), '')
      ) as bl_actor_display_name
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    JOIN user_chart_of_accounts ucoa_current ON jel.account_id = ucoa_current.id
    LEFT JOIN chart_of_accounts_templates t_current ON ucoa_current.template_account_number = t_current.account_number
    LEFT JOIN offsetting_accounts_agg oaa ON oaa.journal_entry_id = je.id
    LEFT JOIN transactions t ON t.current_journal_entry_id = je.id
    LEFT JOIN user_settings us ON us.id = je.created_by_user_id
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
    lwb.bl_account_name,
    lwb.bl_actor_display_name
  FROM lines_with_balance lwb
  ORDER BY lwb.bl_transaction_date DESC, lwb.bl_entry_number DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

CREATE OR REPLACE FUNCTION get_account_audit_history_paginated(
  p_profile_id uuid,
  p_account_id uuid,
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
  account_name text,
  actor_display_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.line_id, r.entry_id, r.entry_number, r.entry_type, r.entry_date,
    r.transaction_date, r.entry_description, r.line_description,
    r.debit_amount, r.credit_amount, r.offsetting_accounts,
    r.transaction_id, r.transaction_status, r.cleared_status,
    r.created_at, r.running_balance, r.total_count,
    r.account_id, r.account_name, r.actor_display_name
  FROM get_multi_account_audit_history_paginated(
    p_profile_id, ARRAY[p_account_id],
    p_start_date, p_end_date, p_limit, p_offset
  ) r;
END;
$$;

GRANT EXECUTE ON FUNCTION get_multi_account_audit_history_paginated TO authenticated;
GRANT EXECUTE ON FUNCTION get_account_audit_history_paginated TO authenticated;
