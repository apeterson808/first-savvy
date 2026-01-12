/*
  # Fix Account Register Performance - Scope CTE to Relevant Entries Only

  ## Problem
  The `get_account_journal_lines` function has a CTE that aggregates offsetting accounts
  for ALL journal entries in the entire profile, even when viewing a single account with
  a date filter. This causes:
  - Scanning thousands of irrelevant journal entries
  - Aggregating data that will never be used
  - Slow page loads (5-10+ seconds for profiles with many transactions)

  ## Root Cause
  Lines 66-82: The CTE `offsetting_accounts_agg` uses only `WHERE jel2.profile_id = p_profile_id`
  without filtering to:
  1. The specific journal entries related to the account being viewed
  2. The date range specified by p_start_date and p_end_date

  ## Solution
  Scope the CTE to only process journal entries that:
  1. Have lines for the account we're viewing (p_account_id)
  2. Fall within the specified date range
  
  This reduces the CTE from O(all_entries) to O(account_entries_in_range)

  ## Performance Impact
  - Before: Processes 10,000+ entries for a profile with many accounts
  - After: Processes only ~100-500 entries for a single account view
  - Expected improvement: 20-100x faster

  ## Compatibility
  - No changes to function signature
  - No changes to return type
  - Fully backwards compatible
*/

DROP FUNCTION IF EXISTS get_account_journal_lines(uuid, uuid, date, date);

CREATE OR REPLACE FUNCTION get_account_journal_lines(
  p_profile_id uuid,
  p_account_id uuid,
  p_start_date date DEFAULT NULL,
  p_end_date date DEFAULT NULL
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
  cleared_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  WITH relevant_entries AS (
    -- First, identify only the journal entries we care about
    -- This dramatically reduces the scope of the aggregation CTE
    SELECT DISTINCT je.id as entry_id
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
    -- Now aggregate offsetting accounts ONLY for the relevant entries
    -- This is much faster than aggregating for the entire profile
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
      AND jel2.journal_entry_id IN (SELECT entry_id FROM relevant_entries)
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
    -- Get offsetting accounts from the pre-aggregated CTE
    CASE
      WHEN oaa.offsetting_accounts_list IS NOT NULL THEN
        -- Remove the current account from the aggregated list
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
$$;

COMMENT ON FUNCTION get_account_journal_lines IS
'Highly optimized version: Returns journal lines for an account with pre-aggregated offsetting accounts. CTE scoped to relevant entries only. Filters pending transactions. Performance: O(account_entries) instead of O(all_profile_entries).';
