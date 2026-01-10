/*
  # Optimize Account Journal Lines Performance

  ## Problem
  The `get_account_journal_lines` function contains a correlated subquery that runs
  once per row returned (N+1 query problem). This causes severe performance degradation
  when loading accounts with thousands of transactions.

  ## Root Cause
  Lines 62-70 in the current function use a correlated subquery to fetch offsetting
  accounts for each journal line. This results in:
  - One query per transaction to get offsetting accounts
  - Accounts with 1000 transactions = 1000+ queries
  - Extremely slow page load times

  ## Solution
  Replace the correlated subquery with a LEFT JOIN to a derived table that pre-aggregates
  the offsetting accounts for all journal entries in one pass. This reduces the query
  from O(N) to O(1) in terms of database round trips.

  ## Performance Impact
  - Before: N+1 queries (one per transaction)
  - After: Single optimized query with one JOIN
  - Expected improvement: 10-100x faster for large accounts

  ## Technical Approach
  1. Create a CTE that aggregates offsetting accounts by journal_entry_id
  2. LEFT JOIN this CTE to the main query
  3. Filter out the current account in the aggregation
  4. Return the pre-aggregated offsetting accounts list

  ## Compatibility
  - No changes to function signature
  - No changes to return type
  - Backwards compatible with existing frontend code
  - Still filters for posted transactions only
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
  WITH offsetting_accounts_agg AS (
    -- Pre-aggregate offsetting accounts for all journal entries in one pass
    -- This eliminates the N+1 query problem
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
    -- Subtract the current account's name from the list since we're viewing that account
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
'Optimized version: Returns all journal lines for an account with pre-aggregated offsetting accounts. Only includes posted transactions and manual journal entries. Pending transactions are filtered out. Includes cleared_status for reconciliation workflow. Performance: O(1) queries instead of O(N).';
