/*
  # Force PostgREST Schema Reload
  
  ## Purpose
  Make a harmless schema change to force PostgREST to reload its cached schema.
  This will make it recognize the journal_entries table.
  
  ## What This Does
  - Adds a comment to the journal_entries table
  - This triggers PostgREST to reload its entire schema cache
*/

-- Update table comment to force schema reload
COMMENT ON TABLE journal_entries IS 'Journal entry headers. Links transactions to accounting entries. Balance impact controlled by transaction status for transaction-linked entries, always impacts balance for manual entries.';

-- Send reload notification
NOTIFY pgrst, 'reload schema';
