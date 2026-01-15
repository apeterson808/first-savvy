/*
  # Cleanup Pending Transfer Journal Entries

  ## Problem
  Due to the bug in create_transfer_journal_entry, pending transfers have journal entries.
  These need to be cleaned up so they don't appear in account registers.

  ## Solution
  1. Find all pending transfers that have journal_entry_id values
  2. Delete those journal entries (and their lines via CASCADE)
  3. Clear the journal_entry_id from the pending transactions

  ## Impact
  - Removes incorrect journal entries from pending transfers
  - Clears the doubled display in account registers
  - Pending transfers will remain in pending state without affecting books
*/

-- Find and delete journal entries for pending transfers
DO $$
DECLARE
  v_entry_ids uuid[];
BEGIN
  -- Get all journal entry IDs from pending transfers
  SELECT ARRAY_AGG(DISTINCT journal_entry_id)
  INTO v_entry_ids
  FROM transactions
  WHERE transfer_pair_id IS NOT NULL
    AND status = 'pending'
    AND journal_entry_id IS NOT NULL;

  -- Delete the journal entries if any exist
  IF v_entry_ids IS NOT NULL AND array_length(v_entry_ids, 1) > 0 THEN
    -- Delete journal entry lines (explicit, though CASCADE would handle this)
    DELETE FROM journal_entry_lines
    WHERE journal_entry_id = ANY(v_entry_ids);

    -- Delete journal entries
    DELETE FROM journal_entries
    WHERE id = ANY(v_entry_ids);

    -- Clear journal_entry_id from pending transfers
    UPDATE transactions
    SET journal_entry_id = NULL
    WHERE transfer_pair_id IS NOT NULL
      AND status = 'pending'
      AND journal_entry_id IS NOT NULL;

    RAISE NOTICE 'Cleaned up % journal entries for pending transfers', array_length(v_entry_ids, 1);
  ELSE
    RAISE NOTICE 'No pending transfer journal entries to clean up';
  END IF;
END $$;
