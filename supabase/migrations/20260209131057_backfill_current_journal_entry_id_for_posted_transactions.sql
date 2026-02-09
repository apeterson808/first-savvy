/*
  # Backfill current_journal_entry_id for Existing Posted Transactions

  ## Problem
  Existing posted transactions have journal_entry_id set but not current_journal_entry_id.
  This prevents the undo_post functions from working.

  ## Solution
  Copy journal_entry_id to current_journal_entry_id and original_journal_entry_id
  for all posted transactions that have journal entries.

  ## Impact
  - All existing posted transactions will be undoable
  - No data loss - just copying existing references
*/

-- Backfill current_journal_entry_id and original_journal_entry_id
UPDATE transactions
SET 
  current_journal_entry_id = journal_entry_id,
  original_journal_entry_id = COALESCE(original_journal_entry_id, journal_entry_id)
WHERE status = 'posted'
  AND journal_entry_id IS NOT NULL
  AND current_journal_entry_id IS NULL;
