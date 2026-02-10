/*
  # Update Existing Reversal Entries to Use Same Reference Number

  ## Summary
  Updates all existing reversal journal entries to use the same entry_number
  as the original entry they reverse. This aligns historical data with the
  new simplified audit trail system.

  ## Changes
  1. Find all reversal entries with a reverses_entry_id
  2. Update their entry_number to match the original entry
  3. Preserve all other data (dates, descriptions, etc.)

  ## Impact
  - All reversal entries will now show the same reference number as their original
  - Chronological order maintained via created_at timestamp
  - No data loss - only entry_number field updated

  ## Safety
  - Only updates reversal entries with valid reverses_entry_id
  - Original entries remain unchanged
  - Preserves all linkage relationships
*/

-- Update all reversal entries to use the same entry_number as their original entry
UPDATE journal_entries je_reversal
SET entry_number = je_original.entry_number
FROM journal_entries je_original
WHERE je_reversal.entry_type = 'reversal'
  AND je_reversal.reverses_entry_id IS NOT NULL
  AND je_reversal.reverses_entry_id = je_original.id
  AND je_reversal.entry_number != je_original.entry_number;

-- Log the result
DO $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % reversal entries to use same reference numbers as their originals', v_updated_count;
END $$;
