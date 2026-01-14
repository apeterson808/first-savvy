/*
  # Force PostgREST Schema Reload
  
  1. Changes
    - Add and update comment on journal_entries table to force PostgREST to reload its schema cache
    - This fixes the 404 error when updating transactions that reference journal_entries
  
  2. Notes
    - PostgREST caches the database schema and sometimes needs to be notified of changes
    - This migration forces a schema reload by making a trivial change
*/

-- Force PostgREST to reload schema cache by updating table comment
COMMENT ON TABLE journal_entries IS 'SOURCE OF TRUTH: General ledger header records. All posted financial activity is stored here and in journal_entry_lines. This is the equivalent of QuickBooks journal entries. [Schema reloaded 2026-01-14]';
