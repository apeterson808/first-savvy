/*
  # Fix register to exclude draft and voided journal entries

  ## Problem
  The register (get_account_journal_lines_paginated) was missing a filter on
  journal_entries.status. It only checked `t.status = 'posted'` on the
  transaction join — but when a transaction is undone, current_journal_entry_id
  is set to NULL so the LEFT JOIN produces t.id IS NULL, which passes the
  `(t.id IS NULL OR t.status = 'posted')` check even though the JE is draft.

  The undone Amazon transaction (JE-0209) was showing in the register because:
  1. Its JE was demoted to 'draft' by undo_posted_transaction
  2. transaction.current_journal_entry_id was cleared to NULL
  3. The LEFT JOIN on current_journal_entry_id returned no row (t.id IS NULL)
  4. The condition (t.id IS NULL OR ...) = TRUE — so the line passed through

  ## Fix
  Add `AND je.status IN ('posted', 'locked')` to both the COUNT query and
  the base_lines CTE in get_account_journal_lines_paginated.
  Also apply the same fix to get_multi_account_journal_lines_paginated.
*/

CREATE OR REPLACE FUNCTION get_account_journal_lines_paginated(
  p_profile_id uuid,
  p_account_id uuid,
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
  account_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_class text;
  v_total_count bigint;
  v_account_name text;
BEGIN
  SELECT
    user_chart_of_accounts.class,
    COALESCE(user_chart_of_accounts.display_name, coa_template.display_name)
  INTO v_account_class, v_account_name
  FROM user_chart_of_accounts
  LEFT JOIN chart_of_accounts_templates coa_template
    ON user_chart_of_accounts.template_account_number = coa_template.account_number
  WHERE user_chart_of_accounts.id = p_account_id;

  SELECT COUNT(*) INTO v_total_count
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.journal_entry_id = je.id
  LEFT JOIN transactions t ON t.current_journal_entry_id = je.id
  WHERE jel.profile_id = p_profile_id
    AND jel.account_id = p_account_id
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
      AND jel2.account_id != p_account_id
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
      CASE
        WHEN v_account_class IN ('asset', 'expense')
        THEN COALESCE(jel.debit_amount, 0) - COALESCE(jel.credit_amount, 0)
        ELSE COALESCE(jel.credit_amount, 0) - COALESCE(jel.debit_amount, 0)
      END                                                             AS bl_net_change,
      jel.line_number                                                 AS bl_line_number
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    LEFT JOIN offsetting_accounts_agg oaa ON oaa.journal_entry_id = je.id
    LEFT JOIN transactions t ON t.current_journal_entry_id = je.id
    LEFT JOIN contacts c ON c.id = t.contact_id
    WHERE jel.profile_id = p_profile_id
      AND jel.account_id = p_account_id
      AND je.status IN ('posted', 'locked')
      AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
      AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
      AND (t.id IS NULL OR t.status = 'posted')
  ),
  lines_with_balance AS (
    SELECT
      bl.*,
      SUM(bl.bl_net_change) OVER (
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
    v_account_name
  FROM lines_with_balance lwb
  ORDER BY lwb.bl_entry_date DESC, lwb.bl_entry_number DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_account_journal_lines_paginated(uuid, uuid, integer, integer, date, date) TO authenticated;
