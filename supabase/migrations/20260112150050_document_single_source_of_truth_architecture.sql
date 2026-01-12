/*
  # Document Single Source of Truth Architecture

  ## Architecture Overview

  This migration documents and enforces the QuickBooks-style single source of truth architecture:

  **SINGLE SOURCE OF TRUTH: journal_entry_lines table**

  All posted financial transactions are stored ONLY in journal_entry_lines.
  The transactions table is a staging/pending area only.

  ## Table Purposes

  ### transactions table (Staging Area)
  - Purpose: Holds PENDING transactions that haven't been categorized or posted yet
  - Status: Only 'pending' transactions should be queried from this table
  - Lifecycle: Once posted, the transaction data lives in journal_entry_lines
  - Think of this like: "Uncleared items in bank reconciliation" or "Inbox"

  ### journal_entries & journal_entry_lines tables (Source of Truth)
  - Purpose: The general ledger - all posted financial activity
  - Status: Only 'posted' journal entries appear in reports and account registers
  - This contains: Regular transactions, transfers, adjustments, opening balances, etc.
  - Think of this like: "The actual accounting books"

  ## Data Flow

  1. User imports transactions → goes to transactions table with status='pending'
  2. User categorizes transaction → still in transactions table, still status='pending'
  3. User/system posts transaction → trigger creates journal entry, sets journal_entry_id
  4. Transaction now has journal_entry_id linking to the journal entry
  5. Account register queries journal_entry_lines for all posted data
  6. UI shows pending items separately (from transactions table where status='pending')

  ## Query Patterns

  ### Account Register Query (Posted Transactions)
  ```sql
  SELECT * FROM get_account_journal_lines(profile_id, account_id, start_date, end_date)
  -- Returns all posted activity for this account from journal_entry_lines
  ```

  ### Pending Transactions Query (Staging Area)
  ```sql
  SELECT * FROM transactions
  WHERE profile_id = ? AND bank_account_id = ? AND status = 'pending'
  -- Returns unposted/pending transactions only
  ```

  ## Benefits of This Architecture

  1. **No Data Duplication**: Posted transactions exist in ONE place
  2. **Clear Separation**: Pending vs Posted is enforced at database level
  3. **Audit Trail**: Journal entries provide complete double-entry audit trail
  4. **Flexibility**: Can add new transaction types without changing core tables
  5. **QuickBooks-Compatible**: Mirrors proven accounting software architecture

*/

-- Add comment to transactions table to document its purpose
COMMENT ON TABLE transactions IS
'STAGING TABLE ONLY: Holds pending/uncategorized transactions. Once posted, the financial data lives in journal_entry_lines. This table maintains a link (journal_entry_id) but is not the source of truth for posted transactions.';

-- Add comment to journal_entries table
COMMENT ON TABLE journal_entries IS
'SOURCE OF TRUTH: General ledger header records. All posted financial activity is stored here and in journal_entry_lines. This is the equivalent of QuickBooks journal entries.';

-- Add comment to journal_entry_lines table
COMMENT ON TABLE journal_entry_lines IS
'SOURCE OF TRUTH: General ledger detail records. Every posted financial transaction is represented as debits and credits in this table. Account registers query this table for all posted activity.';

-- Create a helper view that shows the current state more clearly
CREATE OR REPLACE VIEW account_activity_summary AS
SELECT
  ucoa.id as account_id,
  ucoa.account_number,
  ucoa.display_name,
  ucoa.class as account_class,
  COUNT(DISTINCT CASE WHEN t.status = 'pending' THEN t.id END) as pending_transactions_count,
  COUNT(DISTINCT jel.id) as posted_journal_lines_count,
  COALESCE(SUM(CASE WHEN t.status = 'pending' THEN ABS(t.amount) ELSE 0 END), 0) as pending_amount,
  ucoa.current_balance as posted_balance
FROM user_chart_of_accounts ucoa
LEFT JOIN transactions t ON t.bank_account_id = ucoa.id AND t.status = 'pending'
LEFT JOIN journal_entry_lines jel ON jel.account_id = ucoa.id
WHERE ucoa.is_active = true
GROUP BY ucoa.id, ucoa.account_number, ucoa.display_name, ucoa.class, ucoa.current_balance;

COMMENT ON VIEW account_activity_summary IS
'Helper view showing pending vs posted activity per account. Demonstrates the separation between staging (transactions) and source of truth (journal_entry_lines).';

-- Drop and recreate the get_account_journal_lines function with enhanced return data
DROP FUNCTION IF EXISTS get_account_journal_lines(uuid, uuid, date, date);

CREATE FUNCTION get_account_journal_lines(
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
  source text,
  entry_type text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    jel.id as line_id,
    je.id as entry_id,
    je.entry_number,
    je.entry_date,
    je.description as entry_description,
    jel.description as line_description,
    jel.debit_amount,
    jel.credit_amount,
    (
      -- Get the names of other accounts in this journal entry
      SELECT string_agg(ucoa2.display_name, ', ')
      FROM journal_entry_lines jel2
      JOIN user_chart_of_accounts ucoa2 ON jel2.account_id = ucoa2.id
      WHERE jel2.journal_entry_id = je.id
      AND jel2.account_id != p_account_id
    ) as offsetting_accounts,
    je.source,
    je.entry_type
  FROM journal_entry_lines jel
  JOIN journal_entries je ON jel.journal_entry_id = je.id
  WHERE jel.profile_id = p_profile_id
  AND jel.account_id = p_account_id
  AND je.status = 'posted'
  AND (p_start_date IS NULL OR je.entry_date >= p_start_date)
  AND (p_end_date IS NULL OR je.entry_date <= p_end_date)
  ORDER BY je.entry_date, je.entry_number, jel.line_number;
END;
$$;

COMMENT ON FUNCTION get_account_journal_lines IS
'PRIMARY QUERY for account registers. Returns all posted journal entry lines for an account. This is the single source of truth for posted transactions.';
