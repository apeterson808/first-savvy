/*
  # Fix journal_entry_counters entry_type constraint

  ## Problem
  The journal_entry_counters table may have a CHECK constraint on entry_type
  that only allows the original set of values (adjustment, transfer, opening_balance).
  When generate_journal_entry_number tries to insert a new type like 'charge' or
  'deposit', the constraint rejects it and causes the post_transaction trigger to fail
  with a 400 error.

  ## Fix
  Drop any entry_type constraint on journal_entry_counters. The column is free-text
  and the uniqueness is already enforced by the (profile_id, entry_type) primary key
  or unique constraint. The values written there should be unrestricted.
*/

DO $$
DECLARE
  v_constraint_name text;
BEGIN
  -- Find and drop any check constraint on journal_entry_counters.entry_type
  FOR v_constraint_name IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE t.relname = 'journal_entry_counters'
      AND n.nspname = 'public'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) LIKE '%entry_type%'
  LOOP
    EXECUTE format('ALTER TABLE journal_entry_counters DROP CONSTRAINT IF EXISTS %I', v_constraint_name);
  END LOOP;
END $$;
