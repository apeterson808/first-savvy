/*
  # Fix get_multi_account_journal_lines_paginated to exclude draft/voided JEs

  ## Problem
  Same as the single-account register: missing `je.status IN ('posted', 'locked')`
  filter. Undone transactions showed in the register because their JE was demoted
  to draft but the t.id IS NULL path in the transaction filter still let them through.

  Also removes the stale `REVERSAL:%` description filter — that was a legacy
  mechanism replaced by je.status = 'voided'.
*/

CREATE OR REPLACE FUNCTION get_multi_account_journal_lines_paginated(
  p_profile_id uuid,
  p_account_ids uuid[],
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
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
  transaction_id uuid,
  entry_type text,
  contact_name text,
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
    AND je.status IN ('posted', 'locked')
    AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
    AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
    AND (t.id IS NULL OR t.status = 'posted');

  RETURN QUERY
  WITH offsetting_accounts_agg AS (
    SELECT
      jel2.journal_entry_id,
      string_agg(
        COALESCE(ucoa2.display_name, t2.display_name),
        ', '
        ORDER BY ucoa2.account_number
      ) AS offsetting_accounts_list
    FROM journal_entry_lines jel2
    JOIN user_chart_of_accounts ucoa2 ON jel2.account_id = ucoa2.id
    LEFT JOIN chart_of_accounts_templates t2 ON ucoa2.template_account_number = t2.account_number
    WHERE jel2.profile_id = p_profile_id
      AND NOT (jel2.account_id = ANY(p_account_ids))
    GROUP BY jel2.journal_entry_id
  ),
  base_lines AS (
    SELECT
      jel.id                                                          AS bl_line_id,
      je.id                                                           AS bl_entry_id,
      je.entry_number                                                 AS bl_entry_number,
      je.entry_date                                                   AS bl_entry_date,
      je.description                                                  AS bl_entry_description,
      jel.description                                                 AS bl_line_description,
      jel.debit_amount                                                AS bl_debit_amount,
      jel.credit_amount                                               AS bl_credit_amount,
      oaa.offsetting_accounts_list                                    AS bl_offsetting_accounts,
      COALESCE(t.status, 'posted')::text                              AS bl_transaction_status,
      COALESCE(t.cleared_status, 'uncleared')::text                  AS bl_cleared_status,
      t.id                                                            AS bl_transaction_id,
      je.entry_type                                                   AS bl_entry_type,
      c.name                                                          AS bl_contact_name,
      jel.account_id                                                  AS bl_account_id,
      COALESCE(ucoa.display_name, coa_template.display_name)         AS bl_account_name,
      ucoa.class                                                      AS bl_account_class,
      CASE
        WHEN ucoa.class IN ('asset', 'expense')
        THEN COALESCE(jel.debit_amount, 0) - COALESCE(jel.credit_amount, 0)
        ELSE COALESCE(jel.credit_amount, 0) - COALESCE(jel.debit_amount, 0)
      END                                                             AS bl_net_change,
      jel.line_number                                                 AS bl_line_number
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    JOIN user_chart_of_accounts ucoa ON jel.account_id = ucoa.id
    LEFT JOIN chart_of_accounts_templates coa_template ON ucoa.template_account_number = coa_template.account_number
    LEFT JOIN offsetting_accounts_agg oaa ON oaa.journal_entry_id = je.id
    LEFT JOIN transactions t ON t.current_journal_entry_id = je.id
    LEFT JOIN contacts c ON c.id = t.contact_id
    WHERE jel.profile_id = p_profile_id
      AND jel.account_id = ANY(p_account_ids)
      AND je.status IN ('posted', 'locked')
      AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
      AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
      AND (t.id IS NULL OR t.status = 'posted')
  ),
  lines_with_balance AS (
    SELECT
      bl.*,
      SUM(bl.bl_net_change) OVER (
        PARTITION BY bl.bl_account_id
        ORDER BY bl.bl_entry_date ASC, bl.bl_entry_number ASC, bl.bl_line_number ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS lwb_running_balance
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
    lwb.bl_transaction_id,
    lwb.bl_entry_type,
    lwb.bl_contact_name,
    lwb.bl_account_id,
    lwb.bl_account_name
  FROM lines_with_balance lwb
  ORDER BY lwb.bl_entry_date DESC, lwb.bl_entry_number DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_multi_account_journal_lines_paginated(uuid, uuid[], integer, integer, date, date) TO authenticated;
