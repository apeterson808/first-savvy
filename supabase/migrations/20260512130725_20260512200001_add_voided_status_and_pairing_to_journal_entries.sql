/*
  # Add voided status and pairing columns to journal_entries

  ## Changes
  - Adds 'voided' as a valid status value to journal_entries.status
  - Adds voided_at timestamptz column
  - Adds void_reason text column (values: 'paired', 'replaced', 'user_voided')
  - Adds paired_journal_entry_id uuid FK — voided secondary JE remembers which primary absorbed it

  ## Purpose
  When two transactions are paired as a transfer, the secondary transaction's JE is voided
  (not deleted) so that unpairing can perfectly restore the original state.
*/

-- Add voided_at column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'voided_at'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN voided_at timestamptz;
  END IF;
END $$;

-- Add void_reason column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'void_reason'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN void_reason text
      CHECK (void_reason IN ('paired', 'replaced', 'user_voided'));
  END IF;
END $$;

-- Add paired_journal_entry_id column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'paired_journal_entry_id'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN paired_journal_entry_id uuid
      REFERENCES journal_entries(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Update status CHECK constraint to include 'voided'
-- Drop old constraint if it exists, add new one
DO $$
BEGIN
  ALTER TABLE journal_entries DROP CONSTRAINT IF EXISTS journal_entries_status_check;
  ALTER TABLE journal_entries ADD CONSTRAINT journal_entries_status_check
    CHECK (status IN ('draft', 'posted', 'locked', 'voided'));
EXCEPTION WHEN OTHERS THEN
  NULL; -- constraint may not have existed
END $$;

-- Index for looking up paired entries
CREATE INDEX IF NOT EXISTS idx_journal_entries_paired_je_id
  ON journal_entries(paired_journal_entry_id)
  WHERE paired_journal_entry_id IS NOT NULL;
