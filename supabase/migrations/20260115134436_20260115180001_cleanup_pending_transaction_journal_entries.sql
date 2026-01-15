/*
  # Cleanup Journal Entries for Pending Transactions

  ## Problem
  Due to the bug in the trigger, some pending transactions may have 
  journal entries associated with them. This violates QuickBooks behavior.

  ## Solution
  1. Find all transactions with status='pending' that have journal_entry_id
  2. Delete the associated journal entries and lines
  3. Clear the journal_entry_id from the pending transactions

  ## Safety
  - Only affects pending transactions
  - Posted transactions are not touched
*/

DO $$
DECLARE
  v_deleted_count integer;
BEGIN
  -- Delete journal entry lines for pending transactions
  DELETE FROM journal_entry_lines
  WHERE journal_entry_id IN (
    SELECT journal_entry_id
    FROM transactions
    WHERE status = 'pending' AND journal_entry_id IS NOT NULL
  );

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % journal entry lines for pending transactions', v_deleted_count;

  -- Delete journal entries for pending transactions
  DELETE FROM journal_entries
  WHERE id IN (
    SELECT journal_entry_id
    FROM transactions
    WHERE status = 'pending' AND journal_entry_id IS NOT NULL
  );

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % journal entries for pending transactions', v_deleted_count;

  -- Clear journal_entry_id from pending transactions
  UPDATE transactions
  SET journal_entry_id = NULL
  WHERE status = 'pending' AND journal_entry_id IS NOT NULL;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Cleared journal_entry_id from % pending transactions', v_deleted_count;
END $$;