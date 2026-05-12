/*
  # Fix undo_posted_transaction and audit history UUID crash

  ## Problems Fixed

  ### 1. undo_posted_transaction deletes JE instead of demoting it
  The old function deleted the journal entry after logging. In the JE-first
  architecture, every transaction always has a JE. Instead of deleting, we
  demote the JE back to 'draft' status and restore the suspense line if the
  transaction has no category. The audit log entry is preserved so the undo
  shows up in Audit History.

  ### 2. Audit history crashes with invalid UUID "-orig" suffix
  The single-account audit history function used:
    (al.id::text || '-orig')::uuid
  which creates an invalid UUID string and throws a cast error. Fixed to use:
    md5(al.id::text || '-orig')::uuid
  which produces a valid stable UUID for the synthetic "original" row.
*/

-- Fix undo_posted_transaction to demote JE to draft instead of deleting it
CREATE OR REPLACE FUNCTION undo_posted_transaction(p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id          uuid;
  v_profile_id       uuid;
  v_transaction_status text;
  v_transaction_date date;
  v_journal_entry_id uuid;
  v_entry_number     text;
  v_entry_type       text;
  v_entry_description text;
  v_actor_display_name text;
  v_lines_json       jsonb;
  v_suspense_id      uuid;
  v_bank_account_id  uuid;
  v_bank_class       text;
  v_tx_type          text;
  v_tx_amount        numeric;
  v_bank_is_debit    boolean;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT
    t.status,
    t.date,
    t.current_journal_entry_id,
    t.profile_id,
    t.bank_account_id,
    t.type,
    t.amount
  INTO
    v_transaction_status,
    v_transaction_date,
    v_journal_entry_id,
    v_profile_id,
    v_bank_account_id,
    v_tx_type,
    v_tx_amount
  FROM transactions t
  WHERE t.id = p_transaction_id
    AND has_profile_access(t.profile_id);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction not found or access denied');
  END IF;

  IF v_transaction_status != 'posted' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction is not posted');
  END IF;

  IF v_journal_entry_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No journal entry found for this transaction');
  END IF;

  SELECT entry_number, entry_type, description
  INTO v_entry_number, v_entry_type, v_entry_description
  FROM journal_entries
  WHERE id = v_journal_entry_id;

  -- Capture all journal entry lines for the audit log before demoting
  SELECT jsonb_agg(jsonb_build_object(
    'account_id', jel.account_id,
    'debit_amount', jel.debit_amount,
    'credit_amount', jel.credit_amount,
    'line_number', jel.line_number
  ) ORDER BY jel.line_number)
  INTO v_lines_json
  FROM journal_entry_lines jel
  WHERE jel.journal_entry_id = v_journal_entry_id;

  SELECT COALESCE(
    NULLIF(TRIM(COALESCE(display_name, '')), ''),
    NULLIF(TRIM(COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')), '')
  )
  INTO v_actor_display_name
  FROM user_settings
  WHERE id = v_user_id;

  -- Write audit log BEFORE making any changes
  INSERT INTO audit_logs (
    profile_id,
    user_id,
    actor_display_name,
    action,
    entity_type,
    entity_id,
    description,
    metadata
  ) VALUES (
    v_profile_id,
    v_user_id,
    v_actor_display_name,
    'undo_transaction',
    'transaction',
    p_transaction_id,
    'Undid posting of ' || v_entry_number ||
      CASE WHEN v_entry_description IS NOT NULL AND v_entry_description != ''
        THEN ': ' || v_entry_description
        ELSE ''
      END,
    jsonb_build_object(
      'entry_number',      v_entry_number,
      'entry_type',        v_entry_type,
      'entry_description', v_entry_description,
      'transaction_date',  v_transaction_date,
      'journal_entry_id',  v_journal_entry_id,
      'transaction_id',    p_transaction_id,
      'lines',             COALESCE(v_lines_json, '[]'::jsonb)
    )
  );

  PERFORM set_config('app.internal_status_write', 'true', true);

  -- Demote transaction back to pending
  UPDATE transactions
  SET
    status                    = 'pending',
    current_journal_entry_id  = NULL,
    original_journal_entry_id = NULL,
    updated_at                = now()
  WHERE id = p_transaction_id
    AND profile_id = v_profile_id;

  -- Demote journal entry back to draft (preserve the JE and its number)
  UPDATE journal_entries
  SET
    status     = 'draft',
    posted_at  = NULL,
    posted_by  = NULL,
    updated_at = now()
  WHERE id = v_journal_entry_id
    AND profile_id = v_profile_id;

  PERFORM set_config('app.internal_status_write', 'false', true);

  -- If the transaction had no category, restore the suspense line
  -- (the sync trigger won't fire since status is already pending)
  SELECT id INTO v_suspense_id
  FROM user_chart_of_accounts
  WHERE profile_id = v_profile_id
    AND account_number = 9999
    AND is_system_account = true
  LIMIT 1;

  IF v_suspense_id IS NOT NULL AND v_bank_account_id IS NOT NULL THEN
    -- Check if the transaction still has a category
    IF NOT EXISTS (
      SELECT 1 FROM transactions
      WHERE id = p_transaction_id AND category_account_id IS NOT NULL
    ) THEN
      v_bank_is_debit := get_je_debit_side_for_bank(
        (SELECT class FROM user_chart_of_accounts WHERE id = v_bank_account_id),
        COALESCE(v_tx_type, 'expense'),
        v_tx_amount
      );

      -- Replace non-bank lines with suspense
      DELETE FROM journal_entry_lines
      WHERE journal_entry_id = v_journal_entry_id
        AND account_id != v_bank_account_id;

      INSERT INTO journal_entry_lines (
        journal_entry_id, profile_id, user_id, account_id, line_number,
        debit_amount, credit_amount, description
      )
      SELECT
        v_journal_entry_id,
        v_profile_id,
        v_user_id,
        v_suspense_id,
        1,
        CASE WHEN NOT v_bank_is_debit THEN ABS(v_tx_amount) ELSE NULL END,
        CASE WHEN v_bank_is_debit     THEN ABS(v_tx_amount) ELSE NULL END,
        v_entry_description;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'success',      true,
    'entry_number', v_entry_number,
    'message',      'Transaction moved back to pending'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION undo_posted_transaction(uuid) TO authenticated;


-- Fix the UUID crash in get_account_audit_history_paginated
-- Replace (al.id::text || '-orig')::uuid with md5(...) to get a valid UUID
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

  SELECT SUM(row_count) INTO v_total_count
  FROM (
    SELECT 1 AS row_count
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    LEFT JOIN transactions t ON t.current_journal_entry_id = je.id AND t.bank_account_id = p_account_id
    WHERE jel.profile_id = p_profile_id
      AND jel.account_id = p_account_id
      AND je.status IN ('posted', 'locked')
      AND (p_start_date IS NULL OR COALESCE(t.date, je.entry_date) >= p_start_date)
      AND (p_end_date IS NULL OR COALESCE(t.date, je.entry_date) <= p_end_date)
    UNION ALL
    -- Each undo_transaction audit log produces 2 rows (orig + reversal)
    SELECT 2 AS row_count
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
    -- Regular journal entry lines — posted and locked only
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
      AND je.status IN ('posted', 'locked')
      AND (p_start_date IS NULL OR COALESCE(t.date, je.entry_date) >= p_start_date)
      AND (p_end_date IS NULL OR COALESCE(t.date, je.entry_date) <= p_end_date)

    UNION ALL

    -- Undo row A: reconstruct the ORIGINAL entry from metadata (what was posted)
    SELECT
      md5(al.id::text || '-orig')::uuid                             AS bl_line_id,
      al.id                                                         AS bl_entry_id,
      COALESCE(al.metadata->>'entry_number', 'UNDO')               AS bl_entry_number,
      COALESCE(al.metadata->>'entry_type', 'adjustment')::text     AS bl_entry_type,
      (al.metadata->>'transaction_date')::date                     AS bl_entry_date,
      COALESCE(
        (al.metadata->>'transaction_date')::date,
        al.created_at::date
      )                                                             AS bl_transaction_date,
      COALESCE(al.metadata->>'entry_description', al.description)  AS bl_entry_description,
      COALESCE(al.metadata->>'entry_description', al.description)  AS bl_line_description,
      (
        SELECT (line_elem->>'debit_amount')::numeric
        FROM jsonb_array_elements(COALESCE(al.metadata->'lines', '[]'::jsonb)) AS line_elem
        WHERE (line_elem->>'account_id')::uuid = p_account_id
        LIMIT 1
      )                                                             AS bl_debit_amount,
      (
        SELECT (line_elem->>'credit_amount')::numeric
        FROM jsonb_array_elements(COALESCE(al.metadata->'lines', '[]'::jsonb)) AS line_elem
        WHERE (line_elem->>'account_id')::uuid = p_account_id
        LIMIT 1
      )                                                             AS bl_credit_amount,
      NULL::text                                                    AS bl_offsetting_accounts,
      al.entity_id                                                  AS bl_transaction_id,
      'posted'::text                                                AS bl_transaction_status,
      'uncleared'::text                                             AS bl_cleared_status,
      al.created_at                                                 AS bl_created_at,
      CASE
        WHEN v_account_class IN ('asset', 'expense')
        THEN COALESCE((
          SELECT (line_elem->>'debit_amount')::numeric
          FROM jsonb_array_elements(COALESCE(al.metadata->'lines', '[]'::jsonb)) AS line_elem
          WHERE (line_elem->>'account_id')::uuid = p_account_id LIMIT 1
        ), 0) - COALESCE((
          SELECT (line_elem->>'credit_amount')::numeric
          FROM jsonb_array_elements(COALESCE(al.metadata->'lines', '[]'::jsonb)) AS line_elem
          WHERE (line_elem->>'account_id')::uuid = p_account_id LIMIT 1
        ), 0)
        ELSE COALESCE((
          SELECT (line_elem->>'credit_amount')::numeric
          FROM jsonb_array_elements(COALESCE(al.metadata->'lines', '[]'::jsonb)) AS line_elem
          WHERE (line_elem->>'account_id')::uuid = p_account_id LIMIT 1
        ), 0) - COALESCE((
          SELECT (line_elem->>'debit_amount')::numeric
          FROM jsonb_array_elements(COALESCE(al.metadata->'lines', '[]'::jsonb)) AS line_elem
          WHERE (line_elem->>'account_id')::uuid = p_account_id LIMIT 1
        ), 0)
      END                                                           AS bl_net_change,
      1                                                             AS bl_line_number,
      al.actor_display_name                                         AS bl_actor_display_name,
      NULL::text                                                    AS bl_contact_name
    FROM audit_logs al
    JOIN transactions t_undo ON t_undo.id = al.entity_id AND t_undo.bank_account_id = p_account_id
    WHERE al.profile_id = p_profile_id
      AND al.action = 'undo_transaction'
      AND (p_start_date IS NULL OR al.created_at::date >= p_start_date)
      AND (p_end_date IS NULL OR al.created_at::date <= p_end_date)

    UNION ALL

    -- Undo row B: the REVERSAL — flipped amounts to zero out the running balance
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
      CASE
        WHEN v_account_class IN ('asset', 'expense')
        THEN COALESCE((
          SELECT (line_elem->>'credit_amount')::numeric
          FROM jsonb_array_elements(COALESCE(al.metadata->'lines', '[]'::jsonb)) AS line_elem
          WHERE (line_elem->>'account_id')::uuid = p_account_id LIMIT 1
        ), 0) - COALESCE((
          SELECT (line_elem->>'debit_amount')::numeric
          FROM jsonb_array_elements(COALESCE(al.metadata->'lines', '[]'::jsonb)) AS line_elem
          WHERE (line_elem->>'account_id')::uuid = p_account_id LIMIT 1
        ), 0)
        ELSE COALESCE((
          SELECT (line_elem->>'debit_amount')::numeric
          FROM jsonb_array_elements(COALESCE(al.metadata->'lines', '[]'::jsonb)) AS line_elem
          WHERE (line_elem->>'account_id')::uuid = p_account_id LIMIT 1
        ), 0) - COALESCE((
          SELECT (line_elem->>'credit_amount')::numeric
          FROM jsonb_array_elements(COALESCE(al.metadata->'lines', '[]'::jsonb)) AS line_elem
          WHERE (line_elem->>'account_id')::uuid = p_account_id LIMIT 1
        ), 0)
      END                                                           AS bl_net_change,
      2                                                             AS bl_line_number,
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
      bl.*,
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

GRANT EXECUTE ON FUNCTION get_account_audit_history_paginated(uuid, uuid, integer, integer, date, date) TO authenticated;
