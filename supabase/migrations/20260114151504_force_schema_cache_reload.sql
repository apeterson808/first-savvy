/*
  # Force PostgREST Schema Cache Reload

  ## Issue
  PostgREST schema cache is stale, causing 400 errors when querying tables.
  Errors: "Searched for a foreign keyrelationship in the schema cache"

  ## Solution
  Update table comments to force PostgREST to reload its schema cache.
  This is a standard technique to notify PostgREST of schema changes.
*/

-- Force schema reload by updating comments on core tables
COMMENT ON TABLE user_chart_of_accounts IS
'Unified chart of accounts for all account types. Each user gets their own accounts provisioned from templates. [Schema reloaded 2026-01-14 20:00]';

COMMENT ON TABLE transactions IS
'All financial transactions from all sources (manual, CSV, OFX, API). Links to journal_entries when posted. [Schema reloaded 2026-01-14 20:00]';

COMMENT ON TABLE journal_entries IS
'SOURCE OF TRUTH: General ledger header records. All posted financial activity is stored here and in journal_entry_lines. [Schema reloaded 2026-01-14 20:00]';

COMMENT ON TABLE journal_entry_lines IS
'SOURCE OF TRUTH: Individual debit/credit lines for each journal entry. This is the double-entry bookkeeping record. [Schema reloaded 2026-01-14 20:00]';

COMMENT ON TABLE profiles IS
'Financial profiles representing different accounting entities (personal, business, etc.). Each user can have multiple profiles. [Schema reloaded 2026-01-14 20:00]';

-- Notify PostgREST
NOTIFY pgrst, 'reload schema';
