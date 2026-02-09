/*
  # Create Active Journal Lines View and Audit Trail System

  ## Summary
  Implements clean separation between active and voided journal entries for production UI
  while maintaining full audit trail capability for compliance and troubleshooting.

  ## Key Insight
  Journal entries don't have a status field - instead, voiding is tracked through reversals:
  - Active entries: reversed_by_entry_id IS NULL (not been reversed)
  - Voided entries: reversed_by_entry_id IS NOT NULL (has been reversed)

  ## Changes

  ### 1. New View: active_journal_lines
  - Filters journal_entry_lines to only include non-reversed entries
  - Used by all standard UI components (Transactions, Dashboard, Reports)
  - Prevents voided entries from appearing in normal workflows
  - Maintains same structure as journal_entry_lines for drop-in compatibility

  ### 2. New Function: get_journal_entry_audit_trail
  - Accepts transaction_id as input
  - Returns complete history of ALL journal entries for a transaction
  - Shows original entries, reversals, and re-posted entries
  - Includes reversal relationships and dates
  - Used exclusively by Audit History modal (not shown in normal UI)
  - Provides full chronological audit trail for compliance

  ### 3. Updated Function: get_account_journal_lines_paginated
  - Modified to filter out reversed entries
  - Ensures account registers only show active entries
  - Maintains backward compatibility with existing frontend code

  ## Security
  - View uses security_invoker mode for RLS
  - Audit trail function restricted to authenticated users
  - Both filter by profile_id through profile_memberships

  ## Performance
  - View uses existing index on reversed_by_entry_id
  - Audit trail function optimized for single transaction queries
  - No impact on standard query performance
*/

-- =====================================================
-- 1. CREATE ACTIVE JOURNAL LINES VIEW
-- =====================================================

-- Drop view if exists to allow recreation
DROP VIEW IF EXISTS active_journal_lines;

-- Create view that filters out reversed entries
CREATE VIEW active_journal_lines AS
SELECT
  jel.id,
  jel.journal_entry_id,
  jel.profile_id,
  jel.user_id,
  jel.account_id,
  jel.line_number,
  jel.debit_amount,
  jel.credit_amount,
  jel.description,
  jel.created_at
FROM journal_entry_lines jel
JOIN journal_entries je ON jel.journal_entry_id = je.id
WHERE je.reversed_by_entry_id IS NULL;

COMMENT ON VIEW active_journal_lines IS
'Filtered view of journal_entry_lines showing only non-reversed entries.
Used by standard UI components to hide voided entries from normal workflows.
Voided entries (reversed_by_entry_id IS NOT NULL) remain in journal_entry_lines table for audit purposes.';

-- Enable RLS on the view
ALTER VIEW active_journal_lines SET (security_invoker = true);

-- Grant SELECT permission to authenticated users
GRANT SELECT ON active_journal_lines TO authenticated;

-- =====================================================
-- 2. CREATE AUDIT TRAIL FUNCTION
-- =====================================================

CREATE OR REPLACE FUNCTION get_journal_entry_audit_trail(
  p_transaction_id uuid
)
RETURNS TABLE (
  entry_id uuid,
  entry_number text,
  entry_date date,
  entry_type text,
  source text,
  description text,
  line_id uuid,
  line_number integer,
  account_id uuid,
  account_number text,
  account_name text,
  debit_amount numeric,
  credit_amount numeric,
  line_description text,
  reverses_entry_id uuid,
  reversed_by_entry_id uuid,
  is_current_entry boolean,
  is_voided boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_current_entry_id uuid;
BEGIN
  -- Get profile_id and current_journal_entry_id from transaction
  SELECT t.profile_id, t.current_journal_entry_id
  INTO v_profile_id, v_current_entry_id
  FROM transactions t
  WHERE t.id = p_transaction_id;

  -- Verify user has access to this profile
  IF NOT EXISTS (
    SELECT 1 FROM profile_memberships
    WHERE profile_id = v_profile_id
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied to this transaction';
  END IF;

  -- Return all journal entries related to this transaction
  -- Including original, reversals, and re-posted entries
  RETURN QUERY
  SELECT
    je.id as entry_id,
    je.entry_number,
    je.entry_date,
    je.entry_type,
    je.source,
    je.description,
    jel.id as line_id,
    jel.line_number,
    jel.account_id,
    ucoa.account_number,
    COALESCE(ucoa.display_name, COALESCE(coa_template.display_name, ucoa.account_name)) as account_name,
    jel.debit_amount,
    jel.credit_amount,
    jel.description as line_description,
    je.reverses_entry_id,
    je.reversed_by_entry_id,
    (je.id = v_current_entry_id) as is_current_entry,
    (je.reversed_by_entry_id IS NOT NULL) as is_voided,
    je.created_at,
    je.updated_at
  FROM journal_entries je
  JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
  JOIN user_chart_of_accounts ucoa ON ucoa.id = jel.account_id
  LEFT JOIN chart_of_accounts_templates coa_template ON coa_template.account_number = ucoa.template_account_number
  WHERE je.id IN (
    -- Current journal entry
    SELECT current_journal_entry_id
    FROM transactions
    WHERE id = p_transaction_id
    AND current_journal_entry_id IS NOT NULL

    UNION

    -- Original journal entry
    SELECT original_journal_entry_id
    FROM transactions
    WHERE id = p_transaction_id
    AND original_journal_entry_id IS NOT NULL

    UNION

    -- Any reversal entry
    SELECT unposted_reversal_entry_id
    FROM transactions
    WHERE id = p_transaction_id
    AND unposted_reversal_entry_id IS NOT NULL

    UNION

    -- Any entry that reverses an entry linked to this transaction
    SELECT je2.id
    FROM journal_entries je2
    WHERE je2.reverses_entry_id IN (
      SELECT current_journal_entry_id FROM transactions WHERE id = p_transaction_id
      UNION
      SELECT original_journal_entry_id FROM transactions WHERE id = p_transaction_id
    )

    UNION

    -- Any entry that was reversed by an entry linked to this transaction
    SELECT je3.id
    FROM journal_entries je3
    WHERE je3.reversed_by_entry_id IN (
      SELECT current_journal_entry_id FROM transactions WHERE id = p_transaction_id
      UNION
      SELECT original_journal_entry_id FROM transactions WHERE id = p_transaction_id
    )
  )
  ORDER BY je.created_at, je.entry_number, jel.line_number;
END;
$$;

COMMENT ON FUNCTION get_journal_entry_audit_trail IS
'Returns complete audit trail of all journal entries (active and voided) for a transaction.
Shows original entries, reversals, and re-posted entries with full relationship information.
Used exclusively by Audit History modal - not for standard UI queries.';

GRANT EXECUTE ON FUNCTION get_journal_entry_audit_trail TO authenticated;

-- =====================================================
-- 3. UPDATE EXISTING PAGINATED FUNCTION
-- =====================================================

-- Drop and recreate to allow schema changes
DROP FUNCTION IF EXISTS get_account_journal_lines_paginated(uuid,uuid,date,date,integer,integer);

-- Update get_account_journal_lines_paginated to filter out reversed entries
CREATE FUNCTION get_account_journal_lines_paginated(
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
  -- UPDATED: Filter out reversed entries
  SELECT COUNT(*) INTO v_total_count
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.journal_entry_id = je.id
  LEFT JOIN transactions t ON t.current_journal_entry_id = je.id
  WHERE jel.profile_id = p_profile_id
  AND jel.account_id = p_account_id
  AND je.reversed_by_entry_id IS NULL
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
      jel.id as line_id,
      je.id as entry_id,
      je.entry_number,
      je.entry_date,
      je.description as entry_description,
      jel.description as line_description,
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
      END as offsetting_accounts,
      COALESCE(t.status, 'posted')::text as transaction_status,
      COALESCE(t.cleared_status, 'uncleared')::text as cleared_status,
      CASE
        WHEN v_account_class IN ('asset', 'expense') THEN
          COALESCE(jel.debit_amount, 0) - COALESCE(jel.credit_amount, 0)
        ELSE
          COALESCE(jel.credit_amount, 0) - COALESCE(jel.debit_amount, 0)
      END as net_change,
      jel.line_number
    FROM journal_entry_lines jel
    JOIN journal_entries je ON jel.journal_entry_id = je.id
    LEFT JOIN offsetting_accounts_agg oaa ON oaa.journal_entry_id = je.id
    LEFT JOIN transactions t ON t.current_journal_entry_id = je.id
    LEFT JOIN user_chart_of_accounts ucoa_current ON ucoa_current.id = p_account_id
    LEFT JOIN chart_of_accounts_templates t_current ON ucoa_current.template_account_number = t_current.account_number
    WHERE jel.profile_id = p_profile_id
    AND jel.account_id = p_account_id
    AND je.reversed_by_entry_id IS NULL
    AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
    AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
    AND (t.id IS NULL OR t.status = 'posted')
  ),
  lines_with_balance AS (
    SELECT
      line_id,
      entry_id,
      entry_number,
      entry_date,
      entry_description,
      line_description,
      debit_amount,
      credit_amount,
      offsetting_accounts,
      transaction_status,
      cleared_status,
      SUM(net_change) OVER (
        ORDER BY entry_date, entry_number, line_number
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
      ) as running_balance
    FROM base_lines
  )
  SELECT
    line_id,
    entry_id,
    entry_number,
    entry_date,
    entry_description,
    line_description,
    debit_amount,
    credit_amount,
    offsetting_accounts,
    transaction_status,
    cleared_status,
    running_balance,
    v_total_count as total_count
  FROM lines_with_balance
  ORDER BY entry_date DESC, entry_number DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

COMMENT ON FUNCTION get_account_journal_lines_paginated IS
'Paginated version with running balance calculation. Returns journal lines for an account with pagination support.
UPDATED: Now filters out reversed entries to show only active entries in account registers.
Voided entries (reversed_by_entry_id IS NOT NULL) are accessible via get_journal_entry_audit_trail for audit purposes.';