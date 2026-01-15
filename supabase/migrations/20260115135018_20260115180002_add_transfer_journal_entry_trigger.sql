/*
  # Add Transfer Journal Entry Trigger

  ## Problem
  The create_transfer_journal_entry function exists but is never called.
  When transfers are posted to status='posted', the main transaction trigger
  exits early for transfers (line 55-57), so no journal entries are created.

  ## Solution
  Add a trigger that automatically calls create_transfer_journal_entry when:
  1. A transaction with transfer_pair_id is updated to status='posted'
  2. The paired transaction is also posted
  3. No journal entry has been created yet

  ## Implementation
  - Trigger fires AFTER UPDATE on transactions
  - Only processes transfers (transfer_pair_id IS NOT NULL)
  - Only processes status changes to 'posted'
  - Calls create_transfer_journal_entry to create the journal entry
*/

CREATE OR REPLACE FUNCTION handle_transfer_journal_entry()
RETURNS TRIGGER AS $$
DECLARE
  v_journal_entry_id uuid;
BEGIN
  -- Only process if this is a transfer being posted
  IF NEW.transfer_pair_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Only process when status changes to posted
  IF TG_OP = 'UPDATE' AND (OLD.status = 'posted' OR NEW.status != 'posted') THEN
    RETURN NEW;
  END IF;

  -- Only process if no journal entry exists yet
  IF NEW.journal_entry_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Call the transfer journal entry creation function
  v_journal_entry_id := create_transfer_journal_entry(
    NEW.id,
    NEW.profile_id,
    NEW.user_id
  );

  -- Update the transaction with the journal entry ID
  -- (This will also be done by create_transfer_journal_entry, but we return it here)
  IF v_journal_entry_id IS NOT NULL THEN
    NEW.journal_entry_id := v_journal_entry_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_transfer_journal_entry ON transactions;

-- Create the trigger
CREATE TRIGGER trigger_transfer_journal_entry
  AFTER UPDATE OF status ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION handle_transfer_journal_entry();

COMMENT ON FUNCTION handle_transfer_journal_entry IS
'Automatically creates journal entries for transfers when both sides are posted.
Called after a transfer transaction status changes to posted.';

COMMENT ON TRIGGER trigger_transfer_journal_entry ON transactions IS
'Creates journal entries for completed transfers (both sides posted).';