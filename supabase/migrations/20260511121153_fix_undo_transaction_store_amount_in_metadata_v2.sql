/*
  # Fix undo_posted_transaction to store amounts in audit log metadata

  ## Problem
  The undo function logs an audit row but deletes the journal entry, leaving no
  record of the amount. The audit history function joins on the (now-deleted)
  journal entry lines and gets NULL for debit/credit amounts, so the Amount
  column shows nothing for undo rows.

  ## Fix
  1. Before deleting the journal entry, capture all line amounts and store as
     `lines` array in the audit log metadata JSON.
  2. Rebuild get_account_audit_history_paginated to read debit/credit from
     the stored metadata lines instead of joining deleted journal entry lines.

  ## Changes
  - `undo_posted_transaction`: saves lines snapshot to metadata before DELETE
  - `get_account_audit_history_paginated`: dropped and recreated to read from metadata
*/

-- Step 1: Update undo_posted_transaction to capture amounts before deleting
CREATE OR REPLACE FUNCTION undo_posted_transaction(p_transaction_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_profile_id uuid;
  v_transaction_status text;
  v_journal_entry_id uuid;
  v_entry_number text;
  v_entry_description text;
  v_actor_display_name text;
  v_lines_json jsonb;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT
    t.status,
    t.current_journal_entry_id,
    t.profile_id
  INTO
    v_transaction_status,
    v_journal_entry_id,
    v_profile_id
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

  SELECT entry_number, description
  INTO v_entry_number, v_entry_description
  FROM journal_entries
  WHERE id = v_journal_entry_id;

  -- Capture all journal entry lines before deletion so amounts are preserved in audit log
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
      'entry_number', v_entry_number,
      'entry_description', v_entry_description,
      'journal_entry_id', v_journal_entry_id,
      'transaction_id', p_transaction_id,
      'lines', COALESCE(v_lines_json, '[]'::jsonb)
    )
  );

  PERFORM set_config('app.internal_status_write', 'true', true);

  UPDATE transactions
  SET
    status = 'pending',
    current_journal_entry_id = NULL,
    original_journal_entry_id = NULL,
    updated_at = now()
  WHERE id = p_transaction_id
  AND profile_id = v_profile_id;

  PERFORM set_config('app.internal_status_write', 'false', true);

  DELETE FROM journal_entries
  WHERE id = v_journal_entry_id
  AND profile_id = v_profile_id;

  RETURN jsonb_build_object(
    'success', true,
    'entry_number', v_entry_number,
    'message', 'Transaction moved back to pending'
  );
END;
$$;

-- Step 2: Drop and recreate get_account_audit_history_paginated to read amounts
-- from metadata lines for undo rows (since the original JE was deleted)
DROP FUNCTION IF EXISTS get_account_audit_history_paginated(uuid,uuid,date,date,integer,integer);

CREATE FUNCTION get_account_audit_history_paginated(
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
  actor_display_name text
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
      COALESCE(t.status, 'posted')::text                           AS bl_transaction_status,
      COALESCE(t.cleared_status, 'uncleared')::text               AS bl_cleared_status,
      je.created_at                                                 AS bl_created_at,
      CASE
        WHEN v_account_class IN ('asset', 'expense')
        THEN COALESCE(jel.debit_amount, 0) - COALESCE(jel.credit_amount, 0)
        ELSE COALESCE(jel.credit_amount, 0) - COALESCE(jel.debit_amount, 0)
      END                                                           AS bl_net_change,
      jel.line_number                                               AS bl_line_number,
      ea.ea_actor_name                                              AS bl_actor_display_name
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    LEFT JOIN offsetting_accounts_agg oaa ON oaa.journal_entry_id = je.id
    LEFT JOIN transactions t ON t.current_journal_entry_id = je.id AND t.bank_account_id = p_account_id
    LEFT JOIN user_chart_of_accounts ucoa_current ON ucoa_current.id = p_account_id
    LEFT JOIN chart_of_accounts_templates t_current ON ucoa_current.template_account_number = t_current.account_number
    LEFT JOIN entry_actors ea ON ea.je_id = je.id
    WHERE jel.profile_id = p_profile_id
    AND jel.account_id = p_account_id
    AND (p_start_date IS NULL OR COALESCE(t.date, je.entry_date) >= p_start_date)
    AND (p_end_date IS NULL OR COALESCE(t.date, je.entry_date) <= p_end_date)

    UNION ALL

    -- Undo rows: amounts read from metadata.lines (journal entry was deleted at undo time)
    -- Flip debit/credit to show the reversal direction
    SELECT
      al.id                                                         AS bl_line_id,
      al.id                                                         AS bl_entry_id,
      COALESCE(al.metadata->>'entry_number', 'UNDO')               AS bl_entry_number,
      'undo'::text                                                  AS bl_entry_type,
      al.created_at::date                                           AS bl_entry_date,
      al.created_at::date                                           AS bl_transaction_date,
      al.description                                                AS bl_entry_description,
      al.description                                                AS bl_line_description,
      -- Original credit_amount becomes undo debit (reversal of a charge = debit)
      (
        SELECT (line_elem->>'credit_amount')::numeric
        FROM jsonb_array_elements(COALESCE(al.metadata->'lines', '[]'::jsonb)) AS line_elem
        WHERE (line_elem->>'account_id')::uuid = p_account_id
        LIMIT 1
      )                                                             AS bl_debit_amount,
      -- Original debit_amount becomes undo credit (reversal of a payment = credit)
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
      al.actor_display_name                                         AS bl_actor_display_name
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
    lwb.bl_actor_display_name
  FROM lines_with_balance lwb
  ORDER BY lwb.bl_transaction_date DESC, lwb.bl_entry_number DESC, lwb.bl_line_number DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- Backfill existing undo audit logs to have an empty lines array if missing
-- (old undos where the JE is already gone can't recover amounts, but at least the field exists)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id, metadata
    FROM audit_logs
    WHERE action = 'undo_transaction'
    AND (metadata->'lines') IS NULL
  LOOP
    UPDATE audit_logs
    SET metadata = r.metadata || jsonb_build_object('lines', '[]'::jsonb)
    WHERE id = r.id;
  END LOOP;
END $$;
