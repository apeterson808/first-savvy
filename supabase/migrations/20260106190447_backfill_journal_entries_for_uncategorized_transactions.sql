/*
  # Backfill Journal Entries for Uncategorized Transactions

  ## Overview
  Creates journal entries for all existing posted transactions that don't have them yet.
  This ensures account balances are accurate for all historical transactions.

  ## Strategy
  Use UPDATE to trigger the journal entry creation function for transactions that:
  - Are posted (status = 'posted')
  - Don't have a journal_entry_id
  - Aren't transfers (no transfer_pair_id)
  - Are included in reports
  
  ## Important
  The trigger function will handle assigning uncategorized accounts where needed.
  This is a one-time backfill - future transactions will be handled by the trigger.

  ## Safety
  - Only updates transactions without journal entries (idempotent)
  - Trigger handles all logic for determining categories
  - No data loss risk
*/

-- Backfill by touching each transaction to trigger the function
-- We update a timestamp to trigger the BEFORE UPDATE trigger
UPDATE transactions
SET updated_at = COALESCE(updated_at, now())
WHERE status = 'posted'
  AND journal_entry_id IS NULL
  AND transfer_pair_id IS NULL
  AND include_in_reports = true;

-- Add helpful comment
COMMENT ON COLUMN transactions.journal_entry_id IS 
'References the journal entry created for this transaction. Automatically populated by trigger when transaction is posted.';
