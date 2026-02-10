/*
  # Drop Undo Post Functions

  1. Removed Functions
    - undo_post_transaction - no longer needed, replaced by update_journal_entry
    - undo_post_transfer_pair - no longer needed, edit the shared journal entry instead
    - undo_post_cc_payment_pair - no longer needed, edit the shared journal entry instead
  
  2. Rationale
    - Simplifying from reversal-based undo to direct edit model
    - One function (update_journal_entry) handles all edit cases
    - Cleaner, more intuitive user experience
*/

-- Drop undo functions
DROP FUNCTION IF EXISTS undo_post_transaction(uuid, text);
DROP FUNCTION IF EXISTS undo_post_transfer_pair(uuid, uuid, text);
DROP FUNCTION IF EXISTS undo_post_cc_payment_pair(uuid, uuid, text);

-- Drop the session flag helper if it exists (no longer needed)
DROP FUNCTION IF EXISTS set_session_flag(text, text);
