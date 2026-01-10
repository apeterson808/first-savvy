/*
  # Create Journal Entry Counters Table

  1. New Table
    - `journal_entry_counters`
      - Tracks next available number for each entry type per profile
      - Ensures unique sequential numbering per type (ADJ-0001, TRF-0001, etc.)
      - Atomic increment operations prevent duplicate numbers

  2. Entry Type Prefixes
    - opening_balance: OB
    - adjustment: ADJ
    - transfer: TRF
    - reclassification: RCL
    - closing: CLS
    - depreciation: DEP
    - accrual: ACR
    - reversal: REV

  3. Security
    - Enable RLS on the table
    - Only authenticated users can access their profile counters
    - System functions use SECURITY DEFINER for atomic operations

  4. Performance
    - Indexes on profile_id and entry_type for fast lookups
    - Unique constraint prevents duplicate counters
*/

-- Create journal_entry_counters table
CREATE TABLE IF NOT EXISTS journal_entry_counters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  entry_type text NOT NULL,
  next_number integer NOT NULL DEFAULT 1,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  CONSTRAINT valid_counter_entry_type CHECK (entry_type IN ('opening_balance', 'adjustment', 'transfer', 'reclassification', 'closing', 'depreciation', 'accrual', 'reversal')),
  CONSTRAINT unique_counter_per_profile_type UNIQUE (profile_id, entry_type),
  CONSTRAINT positive_next_number CHECK (next_number > 0)
);

-- Enable RLS
ALTER TABLE journal_entry_counters ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view counters for their profiles"
  ON journal_entry_counters FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = journal_entry_counters.profile_id
      AND profiles.user_id = (select auth.uid())
    )
  );

-- No direct insert/update/delete policies - only system functions can modify counters

-- Create indexes
CREATE INDEX idx_journal_entry_counters_profile_id ON journal_entry_counters(profile_id);
CREATE INDEX idx_journal_entry_counters_entry_type ON journal_entry_counters(entry_type);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_journal_entry_counters_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER journal_entry_counters_updated_at
  BEFORE UPDATE ON journal_entry_counters
  FOR EACH ROW
  EXECUTE FUNCTION update_journal_entry_counters_updated_at();
