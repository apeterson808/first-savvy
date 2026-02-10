/*
  # Backfill Reversal Entries with Original Transaction Dates

  ## Summary
  Updates all existing reversal journal entries to use the same date as their
  original transactions, instead of the date when the reversal was performed.

  ## Changes
  - Updates entry_date for all reversal entries to match their original entry's date
  - Maintains audit trail integrity by showing consistent dates in Date column
  - Action Time (created_at) continues to show when the reversal was performed

  ## Impact
  This ensures all reversal entries show the same Date as their original transaction,
  providing a cleaner audit history where Date represents the business date and
  Action Time represents when the action occurred.
*/

-- Update all reversal entries to use the original entry's date
UPDATE journal_entries AS reversal
SET entry_date = original.entry_date
FROM journal_entries AS original
WHERE reversal.reverses_entry_id = original.id
  AND reversal.entry_date != original.entry_date;

-- Verify the update
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_updated_count
  FROM journal_entries AS reversal
  JOIN journal_entries AS original ON reversal.reverses_entry_id = original.id
  WHERE reversal.entry_date = original.entry_date;
  
  RAISE NOTICE 'Successfully synchronized % reversal entries with their original entry dates', v_updated_count;
END $$;
