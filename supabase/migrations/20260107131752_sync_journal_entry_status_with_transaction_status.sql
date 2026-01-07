/*
  # Sync Journal Entry Status with Transaction Status

  ## Problem
  When transaction status changes from 'posted' to 'pending' (undo action):
  - Transaction status updates correctly
  - BUT journal entry status remains 'posted'
  - Balance doesn't recalculate because journal entry is still active
  
  ## Solution
  Create trigger to sync journal entry status when transaction status changes:
  - Transaction 'posted' → Journal entry 'posted'
  - Transaction 'pending' → Journal entry 'draft'
  - This triggers existing balance recalculation logic
  
  ## Changes
  1. Create trigger function to sync journal entry status
  2. Attach to transactions UPDATE trigger
  3. Backfill any transactions that are pending but have posted journal entries
*/

-- Function to sync journal entry status with transaction status
CREATE OR REPLACE FUNCTION sync_journal_entry_status_with_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only process if transaction has a linked journal entry and status changed
  IF NEW.journal_entry_id IS NOT NULL AND OLD.status IS DISTINCT FROM NEW.status THEN
    
    -- If transaction moved to 'posted', ensure journal entry is 'posted'
    IF NEW.status = 'posted' THEN
      UPDATE journal_entries
      SET status = 'posted'
      WHERE id = NEW.journal_entry_id
        AND status != 'posted';
    
    -- If transaction moved to 'pending', set journal entry to 'draft'
    ELSIF NEW.status = 'pending' THEN
      UPDATE journal_entries
      SET status = 'draft'
      WHERE id = NEW.journal_entry_id
        AND status != 'draft';
    
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to sync statuses
DROP TRIGGER IF EXISTS trigger_sync_journal_entry_status ON transactions;
CREATE TRIGGER trigger_sync_journal_entry_status
  AFTER UPDATE ON transactions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION sync_journal_entry_status_with_transaction();

COMMENT ON TRIGGER trigger_sync_journal_entry_status ON transactions IS
'Syncs journal entry status when transaction status changes. Ensures balance recalculation when transactions are posted/unposted.';

-- Backfill: Set journal entries to 'draft' for any pending transactions
UPDATE journal_entries
SET status = 'draft'
WHERE id IN (
  SELECT journal_entry_id
  FROM transactions
  WHERE status = 'pending'
    AND journal_entry_id IS NOT NULL
)
AND status = 'posted';
