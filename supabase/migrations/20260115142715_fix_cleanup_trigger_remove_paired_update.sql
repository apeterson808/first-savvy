/*
  # Fix Cleanup Trigger - Remove Paired Transaction Update

  ## Problem
  The cleanup_journal_entry_on_unpost trigger was trying to update the paired
  transfer transaction during a BEFORE UPDATE trigger, causing:
  "tuple to be updated was already modified by an operation triggered by the current command"

  ## Solution
  Remove the paired transaction update logic. Each transaction will clean up
  its own journal_entry_id when it gets updated to pending status.
  Since transfers share the same journal_entry_id, deleting the journal entry
  once is sufficient.

  ## Implementation
  - Keep the trigger as BEFORE UPDATE (so we can modify NEW)
  - Remove the UPDATE statement that tries to modify the paired transaction
  - Each transaction handles its own cleanup when its status changes
*/

CREATE OR REPLACE FUNCTION cleanup_journal_entry_on_unpost()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if status is changing from posted to pending
  IF OLD.status = 'posted' AND NEW.status = 'pending' THEN
    
    -- If there's a journal entry associated with this transaction
    IF OLD.journal_entry_id IS NOT NULL THEN
      
      -- Delete the journal entry (CASCADE will delete lines and update balances)
      -- For transfers, both transactions share the same journal_entry_id,
      -- so deleting it once is sufficient. Each transaction will clear its own
      -- journal_entry_id reference when it gets updated.
      DELETE FROM journal_entries 
      WHERE id = OLD.journal_entry_id;
      
      -- Clear the journal_entry_id from this transaction
      NEW.journal_entry_id := NULL;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

COMMENT ON FUNCTION cleanup_journal_entry_on_unpost IS
'Automatically deletes journal entries when transactions are moved from posted to pending status.
Each transaction cleans up its own journal_entry_id reference. For transfers, the journal entry
is deleted when the first transaction is unposted, and the second transaction just clears its reference.';
