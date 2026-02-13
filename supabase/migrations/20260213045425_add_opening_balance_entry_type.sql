/*
  # Add opening_balance to journal entry types

  1. Changes
    - Update the check constraint on journal_entries.entry_type to include 'opening_balance'
    - This allows the system to create opening balance journal entries when accounts are created

  2. Notes
    - Opening balance entries are essential for tracking the initial equity position
    - They link asset/liability accounts to the Opening Balance Equity account
*/

ALTER TABLE journal_entries
  DROP CONSTRAINT IF EXISTS journal_entries_entry_type_check;

ALTER TABLE journal_entries
  ADD CONSTRAINT journal_entries_entry_type_check
  CHECK (entry_type = ANY (ARRAY['transaction'::text, 'adjustment'::text, 'opening_balance'::text]));
