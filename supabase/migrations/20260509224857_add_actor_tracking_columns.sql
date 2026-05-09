/*
  # Add Actor Tracking Columns for Household Audit Trail

  ## Purpose
  Enable per-user attribution of financial actions across household members.
  When Jenna categorizes a transaction or Andrew creates a budget, the system
  records exactly who did it, independent of who owns the profile.

  ## Changes

  ### transactions
  - Add `last_modified_by_user_id` (uuid) — the user who last categorized/edited
    this transaction. Distinct from `user_id` which tracks who imported it.

  ### journal_entries
  - Add `created_by_user_id` (uuid) — the household member who created the entry

  ### budgets
  - Add `created_by_user_id` (uuid) — the household member who created the budget line
  - Add `last_modified_by_user_id` (uuid) — the household member who last edited it

  ### audit_logs
  - Add `actor_display_name` (text) — cached display name of the actor so the UI
    can show "Jenna approved this" without a separate lookup

  ## Notes
  - All columns are nullable to avoid breaking existing rows
  - Foreign keys reference auth.users for referential integrity
*/

-- transactions: track who last modified (categorized) this transaction
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'last_modified_by_user_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN last_modified_by_user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- journal_entries: track who created the entry
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'created_by_user_id'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN created_by_user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- budgets: track who created and who last modified
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'created_by_user_id'
  ) THEN
    ALTER TABLE budgets ADD COLUMN created_by_user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'last_modified_by_user_id'
  ) THEN
    ALTER TABLE budgets ADD COLUMN last_modified_by_user_id uuid REFERENCES auth.users(id);
  END IF;
END $$;

-- audit_logs: add cached actor display name
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'audit_logs' AND column_name = 'actor_display_name'
  ) THEN
    ALTER TABLE audit_logs ADD COLUMN actor_display_name text;
  END IF;
END $$;

-- Index for efficient lookup of recent activity by actor
CREATE INDEX IF NOT EXISTS idx_transactions_last_modified_by ON transactions(last_modified_by_user_id) WHERE last_modified_by_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_audit_logs_profile_created ON audit_logs(profile_id, created_at DESC);
