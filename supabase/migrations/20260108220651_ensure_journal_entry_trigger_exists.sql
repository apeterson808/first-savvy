/*
  # Ensure Journal Entry Trigger is Properly Configured

  ## Purpose
  Verify that the trigger for automatic journal entry creation is properly
  installed and configured to work with the latest function definition.

  ## What This Does
  - Drops existing trigger if it exists (to ensure clean state)
  - Recreates trigger with correct configuration
  - Trigger fires BEFORE INSERT OR UPDATE on transactions
  - Calls auto_create_journal_entry_from_transaction() function
  - Only creates journal entries when status = 'posted' (QuickBooks behavior)

  ## Impact
  - Ensures posted transactions automatically create journal entries
  - Journal entries appear in account registers
  - Account balances update correctly
*/

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trigger_auto_create_journal_entry ON transactions;

-- Recreate trigger with proper configuration
CREATE TRIGGER trigger_auto_create_journal_entry
  BEFORE INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION auto_create_journal_entry_from_transaction();

COMMENT ON TRIGGER trigger_auto_create_journal_entry ON transactions IS
'Automatically creates journal entries for posted transactions (QuickBooks-style).
- INSERT: Creates journal entry if status=posted
- UPDATE: Creates journal entry if status changes to posted OR category added to posted transaction
- Pending transactions do NOT create journal entries
- Journal entries link back to transactions via journal_entry_id';
