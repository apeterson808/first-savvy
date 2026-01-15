/*
  # Cleanup Existing Pending Transaction Journal Entries

  ## Problem
  Transactions that were moved to pending status before the cleanup trigger was created
  still have journal entries associated with them. This causes them to appear in
  account registers.

  ## Solution
  Delete all journal entries associated with pending transactions and clear the
  journal_entry_id reference.

  ## Impact
  - Removes journal entries for all pending transactions
  - Clears journal_entry_id from pending transactions
  - Account registers will only show posted transactions
*/

-- Find and delete journal entries for pending transactions
WITH pending_journal_entries AS (
  SELECT DISTINCT journal_entry_id 
  FROM transactions 
  WHERE status = 'pending' 
    AND journal_entry_id IS NOT NULL
)
DELETE FROM journal_entries 
WHERE id IN (SELECT journal_entry_id FROM pending_journal_entries);

-- Clear journal_entry_id from all pending transactions
UPDATE transactions 
SET journal_entry_id = NULL 
WHERE status = 'pending' 
  AND journal_entry_id IS NOT NULL;
