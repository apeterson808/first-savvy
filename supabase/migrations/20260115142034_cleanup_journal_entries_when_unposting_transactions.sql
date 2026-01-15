/*
  # Cleanup Journal Entries When Unposting Transactions

  ## Problem
  When transactions are moved from 'posted' to 'pending' status, their associated
  journal entries remain in the database. This causes them to still appear in
  account registers even though the transactions are pending.

  ## Solution
  1. Create a trigger that detects when a transaction status changes from 'posted' to 'pending'
  2. Delete the associated journal entry (and all its lines via CASCADE)
  3. Clear the journal_entry_id from the transaction
  4. For transfers, ensure both transactions are handled properly

  ## Implementation
  - Trigger fires BEFORE UPDATE on transactions
  - Only processes status changes from 'posted' to 'pending'
  - Deletes the journal entry if it exists
  - Returns the transaction with journal_entry_id cleared
*/

CREATE OR REPLACE FUNCTION cleanup_journal_entry_on_unpost()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process if status is changing from posted to pending
  IF OLD.status = 'posted' AND NEW.status = 'pending' THEN
    
    -- If there's a journal entry associated with this transaction
    IF OLD.journal_entry_id IS NOT NULL THEN
      
      -- Delete the journal entry (CASCADE will delete lines and update balances)
      DELETE FROM journal_entries 
      WHERE id = OLD.journal_entry_id;
      
      -- Clear the journal_entry_id from the transaction
      NEW.journal_entry_id := NULL;
      
      -- For transfers, also clear the journal_entry_id from the paired transaction
      IF NEW.transfer_pair_id IS NOT NULL THEN
        UPDATE transactions 
        SET journal_entry_id = NULL
        WHERE transfer_pair_id = NEW.transfer_pair_id
          AND id != NEW.id
          AND journal_entry_id = OLD.journal_entry_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_cleanup_journal_on_unpost ON transactions;

-- Create the trigger (BEFORE UPDATE so we can modify NEW)
CREATE TRIGGER trigger_cleanup_journal_on_unpost
  BEFORE UPDATE OF status ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION cleanup_journal_entry_on_unpost();

COMMENT ON FUNCTION cleanup_journal_entry_on_unpost IS
'Automatically deletes journal entries when transactions are moved from posted to pending status.
Ensures the register only shows posted transactions (QuickBooks behavior).';

COMMENT ON TRIGGER trigger_cleanup_journal_on_unpost ON transactions IS
'Cleans up journal entries when transactions are unposted (moved to pending status).';
