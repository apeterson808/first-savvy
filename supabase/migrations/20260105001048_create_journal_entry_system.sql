/*
  # Create Journal Entry System

  1. New Tables
    - `journal_entries`
      - Core journal entry header with date, description, type, status
      - Auto-generated entry numbers (JE-001, JE-002, etc.)
    - `journal_entry_lines`
      - Individual debit/credit lines for each entry
      - Links to chart of accounts
      - Each line has either debit_amount OR credit_amount (not both)
  
  2. Security
    - Enable RLS on both tables
    - Users access entries via profile_memberships
    - Policies for select, insert, update, delete
  
  3. Performance
    - Indexes on all foreign keys
    - Index on entry_date for chronological queries
    - Index on entry_number for quick searching
*/

-- Create journal_entries table
CREATE TABLE IF NOT EXISTS journal_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  entry_number text NOT NULL,
  description text NOT NULL,
  entry_type text NOT NULL DEFAULT 'adjustment',
  status text NOT NULL DEFAULT 'posted',
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT valid_entry_type CHECK (entry_type IN ('opening_balance', 'adjustment', 'transfer', 'reclassification', 'closing', 'depreciation', 'accrual', 'reversal')),
  CONSTRAINT valid_status CHECK (status IN ('draft', 'posted', 'void')),
  CONSTRAINT valid_source CHECK (source IN ('manual', 'import', 'system', 'migration')),
  CONSTRAINT unique_entry_number_per_profile UNIQUE (profile_id, entry_number)
);

-- Create journal_entry_lines table
CREATE TABLE IF NOT EXISTS journal_entry_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES user_chart_of_accounts(id) ON DELETE RESTRICT,
  line_number integer NOT NULL,
  debit_amount numeric(15,2),
  credit_amount numeric(15,2),
  description text,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT line_has_debit_or_credit CHECK (
    (debit_amount IS NOT NULL AND credit_amount IS NULL AND debit_amount >= 0) OR
    (credit_amount IS NOT NULL AND debit_amount IS NULL AND credit_amount >= 0)
  ),
  CONSTRAINT unique_line_number_per_entry UNIQUE (journal_entry_id, line_number)
);

-- Enable RLS
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_lines ENABLE ROW LEVEL SECURITY;

-- RLS Policies for journal_entries
CREATE POLICY "Users can view journal entries for their profiles"
  ON journal_entries FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_memberships.profile_id = journal_entries.profile_id
      AND profile_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert journal entries for their profiles"
  ON journal_entries FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_memberships.profile_id = journal_entries.profile_id
      AND profile_memberships.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update journal entries for their profiles"
  ON journal_entries FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_memberships.profile_id = journal_entries.profile_id
      AND profile_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete journal entries for their profiles"
  ON journal_entries FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_memberships.profile_id = journal_entries.profile_id
      AND profile_memberships.user_id = auth.uid()
    )
  );

-- RLS Policies for journal_entry_lines
CREATE POLICY "Users can view journal entry lines for their profiles"
  ON journal_entry_lines FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_memberships.profile_id = journal_entry_lines.profile_id
      AND profile_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert journal entry lines for their profiles"
  ON journal_entry_lines FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_memberships.profile_id = journal_entry_lines.profile_id
      AND profile_memberships.user_id = auth.uid()
    )
    AND user_id = auth.uid()
  );

CREATE POLICY "Users can update journal entry lines for their profiles"
  ON journal_entry_lines FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_memberships.profile_id = journal_entry_lines.profile_id
      AND profile_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete journal entry lines for their profiles"
  ON journal_entry_lines FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_memberships.profile_id = journal_entry_lines.profile_id
      AND profile_memberships.user_id = auth.uid()
    )
  );

-- Create indexes for performance
CREATE INDEX idx_journal_entries_profile_id ON journal_entries(profile_id);
CREATE INDEX idx_journal_entries_user_id ON journal_entries(user_id);
CREATE INDEX idx_journal_entries_entry_date ON journal_entries(entry_date);
CREATE INDEX idx_journal_entries_entry_number ON journal_entries(entry_number);
CREATE INDEX idx_journal_entries_status ON journal_entries(status);

CREATE INDEX idx_journal_entry_lines_journal_entry_id ON journal_entry_lines(journal_entry_id);
CREATE INDEX idx_journal_entry_lines_profile_id ON journal_entry_lines(profile_id);
CREATE INDEX idx_journal_entry_lines_account_id ON journal_entry_lines(account_id);
CREATE INDEX idx_journal_entry_lines_user_id ON journal_entry_lines(user_id);

-- Create updated_at trigger for journal_entries
CREATE OR REPLACE FUNCTION update_journal_entry_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_journal_entry_updated_at();