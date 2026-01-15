/*
  # Convert Cleanup Trigger to AFTER Trigger

  ## Problem
  The cleanup trigger was a BEFORE trigger that:
  1. Modified NEW.journal_entry_id = NULL
  2. Deleted the journal entry
  3. FK constraint tried to SET NULL on the same row being updated
  4. Caused error: "tuple to be updated was already modified"

  ## Solution
  Convert to AFTER trigger and update the transaction explicitly.
  This avoids the conflict with the FK constraint.
*/

-- Drop the old BEFORE trigger
DROP TRIGGER IF EXISTS trigger_cleanup_journal_on_unpost ON transactions;

-- Recreate as AFTER trigger
CREATE OR REPLACE FUNCTION cleanup_journal_entry_on_unpost()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if status is changing from posted to pending
  IF OLD.status = 'posted' AND NEW.status = 'pending' THEN
    
    -- If there's a journal entry associated with this transaction
    IF OLD.journal_entry_id IS NOT NULL THEN
      
      -- Delete the journal entry (CASCADE will delete lines)
      -- FK constraint will SET NULL the journal_entry_id automatically
      DELETE FROM journal_entries 
      WHERE id = OLD.journal_entry_id;
      
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Create AFTER trigger instead of BEFORE
CREATE TRIGGER trigger_cleanup_journal_on_unpost
  AFTER UPDATE OF status ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_journal_entry_on_unpost();

COMMENT ON FUNCTION cleanup_journal_entry_on_unpost IS
'Automatically deletes journal entries when transactions are moved from posted to pending status.
Runs as AFTER trigger to avoid conflicts with FK constraints.';
