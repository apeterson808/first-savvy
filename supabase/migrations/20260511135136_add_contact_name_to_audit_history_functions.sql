/*
  # Add contact_name to audit history paginated functions

  ## Summary
  The From/To column in the Audit History tab was blank for regular transactions
  because both audit history functions (single-account and multi-account) were
  not joining the contacts table and not returning contact_name.

  ## Changes
  - `get_account_audit_history_paginated`: adds contact join in base_lines CTE,
    propagates contact_name through lines_with_balance, adds contact_name to
    RETURNS TABLE definition and final SELECT.
  - `get_multi_account_audit_history_paginated`: same additions.

  ## Notes
  - Contact is joined via the transaction row (t.contact_id → contacts.name).
  - Undo rows always return NULL for contact_name (no transaction contact context).
  - No data is modified; this is a schema-compatible addition to function output.
*/

-- ============================================================
-- 1. Single-account audit history
-- ============================================================
CREATE OR REPLACE FUNCTION get_account_audit_history_paginated(
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
  actor_display_name text,
  contact_name text
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
  FROM (
    SELECT jel.id
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    LEFT JOIN transactions t ON t.current_journal_entry_id = je.id AND t.bank_account_id = p_account_id
    WHERE jel.profile_id = p_profile_id
    AND jel.account_id = p_account_id
    AND (p_start_date IS NULL OR COALESCE(t.date, je.entry_date) >= p_start_date)
    AND (p_end_date IS NULL OR COALESCE(t.date, je.entry_date) <= p_end_date)
    UNION ALL
    SELECT al.id
    FROM audit_logs al
    JOIN transactions t2 ON t2.id = al.entity_id AND t2.bank_account_id = p_account_id
    WHERE al.profile_id = p_profile_id
    AND al.action = 'undo_transaction'
    AND (p_start_date IS NULL OR al.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at::date <= p_end_date)
  ) counted;

  RETURN QUERY
  WITH offsetting_accounts_agg AS (
    SELECT
      jel2.journal_entry_id,
      string_agg(
        COALESCE(ucoa2.display_name, t2.display_name),
        ', '
        ORDER BY ucoa2.account_number
      ) AS all_accounts_list
    FROM journal_entry_lines jel2
    JOIN user_chart_of_accounts ucoa2 ON jel2.account_id = ucoa2.id
    LEFT JOIN chart_of_accounts_templates t2 ON ucoa2.template_account_number = t2.account_number
    WHERE jel2.profile_id = p_profile_id
    GROUP BY jel2.journal_entry_id
  ),
  entry_actors AS (
    SELECT DISTINCT ON (combined.je_id)
      combined.je_id,
      combined.ea_actor_name
    FROM (
      SELECT
        (al.metadata->>'journal_entry_id')::uuid AS je_id,
        al.actor_display_name AS ea_actor_name,
        al.created_at
      FROM audit_logs al
      WHERE al.profile_id = p_profile_id
      AND al.action IN ('post_transaction', 'create_journal_entry', 'edit_journal_entry')
      AND al.metadata->>'journal_entry_id' IS NOT NULL
      UNION ALL
      SELECT
        al.entity_id AS je_id,
        al.actor_display_name AS ea_actor_name,
        al.created_at
      FROM audit_logs al
      WHERE al.profile_id = p_profile_id
      AND al.action IN ('post_transaction', 'create_journal_entry', 'edit_journal_entry')
      AND al.entity_type = 'journal_entry'
    ) combined
    ORDER BY combined.je_id, combined.created_at DESC
  ),
  base_lines AS (
    -- Regular journal entry lines
    SELECT
      jel.id                                                        AS bl_line_id,
      je.id                                                         AS bl_entry_id,
      je.entry_number                                               AS bl_entry_number,
      je.entry_type                                                 AS bl_entry_type,
      je.entry_date                                                 AS bl_entry_date,
      COALESCE(t.date, je.entry_date)                               AS bl_transaction_date,
      je.description                                                AS bl_entry_description,
      jel.description                                               AS bl_line_description,
      jel.debit_amount                                              AS bl_debit_amount,
      jel.credit_amount                                             AS bl_credit_amount,
      CASE
        WHEN oaa.all_accounts_list IS NOT NULL THEN
          TRIM(BOTH ', ' FROM REPLACE(
            ', ' || oaa.all_accounts_list || ', ',
            ', ' || COALESCE(ucoa_current.display_name, t_current.display_name) || ', ',
            ', '
          ))
        ELSE NULL
      END                                                           AS bl_offsetting_accounts,
      t.id                                                          AS bl_transaction_id,
      COALESCE(t.status, 'posted')::text                            AS bl_transaction_status,
      COALESCE(t.cleared_status, 'uncleared')::text                AS bl_cleared_status,
      je.created_at                                                 AS bl_created_at,
      CASE
        WHEN v_account_class IN ('asset', 'expense')
        THEN COALESCE(jel.debit_amount, 0) - COALESCE(jel.credit_amount, 0)
        ELSE COALESCE(jel.credit_amount, 0) - COALESCE(jel.debit_amount, 0)
      END                                                           AS bl_net_change,
      jel.line_number                                               AS bl_line_number,
      ea.ea_actor_name                                              AS bl_actor_display_name,
      c.name                                                        AS bl_contact_name
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    LEFT JOIN offsetting_accounts_agg oaa ON oaa.journal_entry_id = je.id
    LEFT JOIN transactions t ON t.current_journal_entry_id = je.id AND t.bank_account_id = p_account_id
    LEFT JOIN contacts c ON c.id = t.contact_id
    LEFT JOIN user_chart_of_accounts ucoa_current ON ucoa_current.id = p_account_id
    LEFT JOIN chart_of_accounts_templates t_current ON ucoa_current.template_account_number = t_current.account_number
    LEFT JOIN entry_actors ea ON ea.je_id = je.id
    WHERE jel.profile_id = p_profile_id
    AND jel.account_id = p_account_id
    AND (p_start_date IS NULL OR COALESCE(t.date, je.entry_date) >= p_start_date)
    AND (p_end_date IS NULL OR COALESCE(t.date, je.entry_date) <= p_end_date)

    UNION ALL

    -- Undo rows
    SELECT
      al.id                                                         AS bl_line_id,
      al.id                                                         AS bl_entry_id,
      COALESCE(al.metadata->>'entry_number', 'UNDO')               AS bl_entry_number,
      'undo'::text                                                  AS bl_entry_type,
      al.created_at::date                                           AS bl_entry_date,
      al.created_at::date                                           AS bl_transaction_date,
      al.description                                                AS bl_entry_description,
      al.description                                                AS bl_line_description,
      (
        SELECT (line_elem->>'credit_amount')::numeric
        FROM jsonb_array_elements(COALESCE(al.metadata->'lines', '[]'::jsonb)) AS line_elem
        WHERE (line_elem->>'account_id')::uuid = p_account_id
        LIMIT 1
      )                                                             AS bl_debit_amount,
      (
        SELECT (line_elem->>'debit_amount')::numeric
        FROM jsonb_array_elements(COALESCE(al.metadata->'lines', '[]'::jsonb)) AS line_elem
        WHERE (line_elem->>'account_id')::uuid = p_account_id
        LIMIT 1
      )                                                             AS bl_credit_amount,
      NULL::text                                                    AS bl_offsetting_accounts,
      al.entity_id                                                  AS bl_transaction_id,
      'pending'::text                                               AS bl_transaction_status,
      'uncleared'::text                                             AS bl_cleared_status,
      al.created_at                                                 AS bl_created_at,
      0::numeric                                                    AS bl_net_change,
      0                                                             AS bl_line_number,
      al.actor_display_name                                         AS bl_actor_display_name,
      NULL::text                                                    AS bl_contact_name
    FROM audit_logs al
    JOIN transactions t_undo ON t_undo.id = al.entity_id AND t_undo.bank_account_id = p_account_id
    WHERE al.profile_id = p_profile_id
    AND al.action = 'undo_transaction'
    AND (p_start_date IS NULL OR al.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at::date <= p_end_date)
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
      bl.bl_line_number,
      bl.bl_actor_display_name,
      bl.bl_contact_name,
      SUM(bl.bl_net_change) OVER (
        ORDER BY bl.bl_transaction_date ASC, bl.bl_entry_number ASC, bl.bl_line_number ASC
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) AS lwb_running_balance
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
    lwb.bl_actor_display_name,
    lwb.bl_contact_name
  FROM lines_with_balance lwb
  ORDER BY lwb.bl_transaction_date DESC, lwb.bl_entry_number DESC, lwb.bl_line_number DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION get_account_audit_history_paginated(uuid, uuid, integer, integer, date, date) TO authenticated;


-- ============================================================
-- 2. Multi-account audit history
-- ============================================================
CREATE OR REPLACE FUNCTION get_multi_account_audit_history_paginated(
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
  actor_display_name text,
  contact_name text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total_count bigint;
BEGIN
  SELECT COUNT(*) INTO v_total_count
  FROM (
    SELECT jel.id
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    LEFT JOIN transactions t ON t.current_journal_entry_id = je.id AND t.bank_account_id = ANY(p_account_ids)
    WHERE jel.profile_id = p_profile_id
    AND jel.account_id = ANY(p_account_ids)
    AND (p_start_date IS NULL OR COALESCE(t.date, je.entry_date) >= p_start_date)
    AND (p_end_date IS NULL OR COALESCE(t.date, je.entry_date) <= p_end_date)
    UNION ALL
    SELECT al.id
    FROM audit_logs al
    JOIN transactions t2 ON t2.id = al.entity_id AND t2.bank_account_id = ANY(p_account_ids)
    WHERE al.profile_id = p_profile_id
    AND al.action = 'undo_transaction'
    AND (p_start_date IS NULL OR al.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at::date <= p_end_date)
  ) counted;

  RETURN QUERY
  WITH offsetting_accounts_agg AS (
    SELECT
      jel2.journal_entry_id,
      string_agg(
        COALESCE(ucoa2.display_name, tmpl2.display_name),
        ', '
        ORDER BY ucoa2.account_number
      ) AS all_accounts_list
    FROM journal_entry_lines jel2
    JOIN user_chart_of_accounts ucoa2 ON jel2.account_id = ucoa2.id
    LEFT JOIN chart_of_accounts_templates tmpl2 ON ucoa2.template_account_number = tmpl2.account_number
    WHERE jel2.profile_id = p_profile_id
    GROUP BY jel2.journal_entry_id
  ),
  entry_actors AS (
    SELECT DISTINCT ON (combined.je_id)
      combined.je_id,
      combined.ea_actor_name
    FROM (
      SELECT
        (al.metadata->>'journal_entry_id')::uuid AS je_id,
        al.actor_display_name AS ea_actor_name,
        al.created_at
      FROM audit_logs al
      WHERE al.profile_id = p_profile_id
      AND al.action IN ('post_transaction', 'create_journal_entry', 'edit_journal_entry')
      AND al.metadata->>'journal_entry_id' IS NOT NULL
      UNION ALL
      SELECT
        al.entity_id AS je_id,
        al.actor_display_name AS ea_actor_name,
        al.created_at
      FROM audit_logs al
      WHERE al.profile_id = p_profile_id
      AND al.action IN ('post_transaction', 'create_journal_entry', 'edit_journal_entry')
      AND al.entity_type = 'journal_entry'
    ) combined
    ORDER BY combined.je_id, combined.created_at DESC
  ),
  base_lines AS (
    SELECT
      jel.id                                                        AS bl_line_id,
      je.id                                                         AS bl_entry_id,
      je.entry_number                                               AS bl_entry_number,
      je.entry_type                                                 AS bl_entry_type,
      je.entry_date                                                 AS bl_entry_date,
      COALESCE(t.date, je.entry_date)                               AS bl_transaction_date,
      je.description                                                AS bl_entry_description,
      jel.description                                               AS bl_line_description,
      jel.debit_amount                                              AS bl_debit_amount,
      jel.credit_amount                                             AS bl_credit_amount,
      CASE
        WHEN oaa.all_accounts_list IS NOT NULL THEN
          TRIM(BOTH ', ' FROM REPLACE(
            ', ' || oaa.all_accounts_list || ', ',
            ', ' || COALESCE(ucoa_current.display_name, tmpl_current.display_name) || ', ',
            ', '
          ))
        ELSE NULL
      END                                                           AS bl_offsetting_accounts,
      t.id                                                          AS bl_transaction_id,
      COALESCE(t.status, 'posted')::text                            AS bl_transaction_status,
      COALESCE(t.cleared_status, 'uncleared')::text                AS bl_cleared_status,
      je.created_at                                                 AS bl_created_at,
      0::numeric                                                    AS bl_net_change,
      jel.line_number                                               AS bl_line_number,
      ea.ea_actor_name                                              AS bl_actor_display_name,
      jel.account_id                                                AS bl_account_id,
      COALESCE(ucoa_current.display_name, tmpl_current.display_name) AS bl_account_name,
      c.name                                                        AS bl_contact_name
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    LEFT JOIN offsetting_accounts_agg oaa ON oaa.journal_entry_id = je.id
    LEFT JOIN transactions t ON t.current_journal_entry_id = je.id AND t.bank_account_id = ANY(p_account_ids)
    LEFT JOIN contacts c ON c.id = t.contact_id
    LEFT JOIN user_chart_of_accounts ucoa_current ON ucoa_current.id = jel.account_id
    LEFT JOIN chart_of_accounts_templates tmpl_current ON ucoa_current.template_account_number = tmpl_current.account_number
    LEFT JOIN entry_actors ea ON ea.je_id = je.id
    WHERE jel.profile_id = p_profile_id
    AND jel.account_id = ANY(p_account_ids)
    AND (p_start_date IS NULL OR COALESCE(t.date, je.entry_date) >= p_start_date)
    AND (p_end_date IS NULL OR COALESCE(t.date, je.entry_date) <= p_end_date)

    UNION ALL

    SELECT
      al.id                                                         AS bl_line_id,
      al.id                                                         AS bl_entry_id,
      COALESCE(al.metadata->>'entry_number', 'UNDO')               AS bl_entry_number,
      'undo'::text                                                  AS bl_entry_type,
      al.created_at::date                                           AS bl_entry_date,
      al.created_at::date                                           AS bl_transaction_date,
      al.description                                                AS bl_entry_description,
      al.description                                                AS bl_line_description,
      (
        SELECT (line_elem->>'credit_amount')::numeric
        FROM jsonb_array_elements(COALESCE(al.metadata->'lines', '[]'::jsonb)) AS line_elem
        WHERE (line_elem->>'account_id')::uuid = ANY(p_account_ids)
        LIMIT 1
      )                                                             AS bl_debit_amount,
      (
        SELECT (line_elem->>'debit_amount')::numeric
        FROM jsonb_array_elements(COALESCE(al.metadata->'lines', '[]'::jsonb)) AS line_elem
        WHERE (line_elem->>'account_id')::uuid = ANY(p_account_ids)
        LIMIT 1
      )                                                             AS bl_credit_amount,
      NULL::text                                                    AS bl_offsetting_accounts,
      al.entity_id                                                  AS bl_transaction_id,
      'pending'::text                                               AS bl_transaction_status,
      'uncleared'::text                                             AS bl_cleared_status,
      al.created_at                                                 AS bl_created_at,
      0::numeric                                                    AS bl_net_change,
      0                                                             AS bl_line_number,
      al.actor_display_name                                         AS bl_actor_display_name,
      t_undo.bank_account_id                                        AS bl_account_id,
      NULL::text                                                    AS bl_account_name,
      NULL::text                                                    AS bl_contact_name
    FROM audit_logs al
    JOIN transactions t_undo ON t_undo.id = al.entity_id AND t_undo.bank_account_id = ANY(p_account_ids)
    WHERE al.profile_id = p_profile_id
    AND al.action = 'undo_transaction'
    AND (p_start_date IS NULL OR al.created_at::date >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at::date <= p_end_date)
  )
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
    0::numeric AS lwb_running_balance,
    v_total_count,
    bl.bl_account_id,
    bl.bl_account_name,
    bl.bl_actor_display_name,
    bl.bl_contact_name
  FROM base_lines bl
  ORDER BY bl.bl_transaction_date DESC, bl.bl_entry_number DESC, bl.bl_line_number DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_multi_account_audit_history_paginated(uuid, uuid[], integer, integer, date, date) TO authenticated;
