/*
  # Fix entry_type constraint to include transfer and undo

  ## Problem
  The journal_entries_entry_type_check constraint was missing 'transfer' and 'undo'
  types that were already being written by the trigger and audit functions.
  This caused 400 errors when posting transactions that were transfers.

  ## Fix
  - Add 'transfer' and 'undo' to the allowed entry_type values
  - These were omitted from the constraint expansion in the previous migration
*/

ALTER TABLE journal_entries
  DROP CONSTRAINT IF EXISTS journal_entries_entry_type_check;

ALTER TABLE journal_entries
  ADD CONSTRAINT journal_entries_entry_type_check
  CHECK (entry_type = ANY (ARRAY[
    'transaction', 'adjustment', 'opening_balance',
    'transfer', 'deposit', 'withdrawal',
    'charge', 'payment', 'expense', 'refund',
    'undo'
  ]));
