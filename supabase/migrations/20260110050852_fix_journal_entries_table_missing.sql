/*
  # Fix Missing Journal Entries Table

  ## Problem
  The journal_entries table reference is causing 404 errors when updating transactions.
  This migration ensures the journal system is properly initialized.

  ## What This Does
  1. Creates journal_entries table if it doesn't exist
  2. Creates journal_entry_lines table if it doesn't exist
  3. Ensures proper RLS policies
  4. Ensures proper indexes

  ## Impact
  - Fixes "relation journal_entries does not exist" errors
  - Allows transactions to be updated properly
  - Enables automatic journal entry creation for posted transactions
*/

-- Create journal_entries table if it doesn't exist
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  entry_number text NOT NULL,
  description text NOT NULL,
  entry_type text NOT NULL DEFAULT 'adjustment'
    CHECK (entry_type IN ('opening_balance', 'adjustment', 'transfer', 'reclassification', 'closing', 'depreciation', 'accrual', 'reversal')),
  source text NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'import', 'system', 'migration')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE journal_entries IS 'Permanent journal entry records. For transaction-linked entries, balance impact is controlled by transactions.status. For manual entries, always affects balance.';

-- Create journal_entry_lines table if it doesn't exist
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES user_chart_of_accounts(id) ON DELETE RESTRICT,
  line_number integer NOT NULL,
  debit_amount numeric,
  credit_amount numeric,
  description text,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for journal_entries
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'journal_entries' 
    AND policyname = 'Users can view journal entries for their profiles'
  ) THEN
    CREATE POLICY "Users can view journal entries for their profiles"
      ON journal_entries
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = journal_entries.profile_id
          AND profiles.user_id = (select auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'journal_entries' 
    AND policyname = 'Users can insert journal entries for their profiles'
  ) THEN
    CREATE POLICY "Users can insert journal entries for their profiles"
      ON journal_entries
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = journal_entries.profile_id
          AND profiles.user_id = (select auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'journal_entries' 
    AND policyname = 'Users can update journal entries for their profiles'
  ) THEN
    CREATE POLICY "Users can update journal entries for their profiles"
      ON journal_entries
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = journal_entries.profile_id
          AND profiles.user_id = (select auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'journal_entries' 
    AND policyname = 'Users can delete journal entries for their profiles'
  ) THEN
    CREATE POLICY "Users can delete journal entries for their profiles"
      ON journal_entries
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM profiles
          WHERE profiles.id = journal_entries.profile_id
          AND profiles.user_id = (select auth.uid())
        )
      );
  END IF;
END $$;

-- RLS Policies for journal_entry_lines
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'journal_entry_lines' 
    AND policyname = 'Users can view journal entry lines for their profiles'
  ) THEN
    CREATE POLICY "Users can view journal entry lines for their profiles"
      ON journal_entry_lines
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM journal_entries je
          JOIN profiles p ON p.id = je.profile_id
          WHERE je.id = journal_entry_lines.journal_entry_id
          AND p.user_id = (select auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'journal_entry_lines' 
    AND policyname = 'Users can insert journal entry lines for their profiles'
  ) THEN
    CREATE POLICY "Users can insert journal entry lines for their profiles"
      ON journal_entry_lines
      FOR INSERT
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM journal_entries je
          JOIN profiles p ON p.id = je.profile_id
          WHERE je.id = journal_entry_lines.journal_entry_id
          AND p.user_id = (select auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'journal_entry_lines' 
    AND policyname = 'Users can update journal entry lines for their profiles'
  ) THEN
    CREATE POLICY "Users can update journal entry lines for their profiles"
      ON journal_entry_lines
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM journal_entries je
          JOIN profiles p ON p.id = je.profile_id
          WHERE je.id = journal_entry_lines.journal_entry_id
          AND p.user_id = (select auth.uid())
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'journal_entry_lines' 
    AND policyname = 'Users can delete journal entry lines for their profiles'
  ) THEN
    CREATE POLICY "Users can delete journal entry lines for their profiles"
      ON journal_entry_lines
      FOR DELETE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM journal_entries je
          JOIN profiles p ON p.id = je.profile_id
          WHERE je.id = journal_entry_lines.journal_entry_id
          AND p.user_id = (select auth.uid())
        )
      );
  END IF;
END $$;

-- Add indexes
CREATE INDEX IF NOT EXISTS idx_journal_entries_profile_id ON journal_entries(profile_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_entry_date ON journal_entries(entry_date);

CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_journal_entry_id ON journal_entry_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_profile_id ON journal_entry_lines(profile_id);
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_account_id ON journal_entry_lines(account_id);
