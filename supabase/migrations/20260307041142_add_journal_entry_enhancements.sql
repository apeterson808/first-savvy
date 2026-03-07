/*
  # Add Journal Entry Enhancements

  1. New Tables
    - `journal_entry_attachments`
      - `id` (uuid, primary key)
      - `journal_entry_id` (uuid, foreign key)
      - `profile_id` (uuid, foreign key)
      - `file_name` (text)
      - `file_size` (integer)
      - `file_type` (text)
      - `storage_path` (text)
      - `uploaded_by` (uuid, foreign key to auth.users)
      - `created_at` (timestamptz)

  2. Changes to journal_entries table
    - Add `memo` field for additional notes
    - Add `status` field (draft, posted, locked)
    - Add `posted_at` field
    - Add `posted_by` field

  3. Security
    - Enable RLS on journal_entry_attachments
    - Add policies for authenticated users to manage their attachments
*/

-- Add new columns to journal_entries
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'memo'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN memo text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'status'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN status text DEFAULT 'posted' CHECK (status IN ('draft', 'posted', 'locked'));
    COMMENT ON COLUMN journal_entries.status IS 'Entry status: draft (not yet posted), posted (active), locked (cannot be edited)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'posted_at'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN posted_at timestamptz;
    COMMENT ON COLUMN journal_entries.posted_at IS 'Timestamp when entry was posted (NULL for draft entries)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'journal_entries' AND column_name = 'posted_by'
  ) THEN
    ALTER TABLE journal_entries ADD COLUMN posted_by uuid REFERENCES auth.users(id);
    COMMENT ON COLUMN journal_entries.posted_by IS 'User who posted this entry (NULL for draft entries)';
  END IF;
END $$;

-- Create journal_entry_attachments table
CREATE TABLE IF NOT EXISTS journal_entry_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id uuid NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_size integer NOT NULL CHECK (file_size > 0),
  file_type text NOT NULL,
  storage_path text NOT NULL,
  uploaded_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);

-- Add comment
COMMENT ON TABLE journal_entry_attachments IS 'Attachments for journal entries (receipts, invoices, supporting documents)';

-- Enable RLS
ALTER TABLE journal_entry_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for journal_entry_attachments
CREATE POLICY "Users can view attachments for their profile entries"
  ON journal_entry_attachments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_memberships.profile_id = journal_entry_attachments.profile_id
      AND profile_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert attachments for their profile entries"
  ON journal_entry_attachments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_memberships.profile_id = journal_entry_attachments.profile_id
      AND profile_memberships.user_id = auth.uid()
    )
    AND uploaded_by = auth.uid()
  );

CREATE POLICY "Users can delete their own attachments"
  ON journal_entry_attachments FOR DELETE
  TO authenticated
  USING (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM profile_memberships
      WHERE profile_memberships.profile_id = journal_entry_attachments.profile_id
      AND profile_memberships.user_id = auth.uid()
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_journal_entry_attachments_journal_entry_id 
  ON journal_entry_attachments(journal_entry_id);

CREATE INDEX IF NOT EXISTS idx_journal_entry_attachments_profile_id 
  ON journal_entry_attachments(profile_id);

-- Update existing entries to have posted status and timestamp
UPDATE journal_entries 
SET 
  status = 'posted',
  posted_at = created_at,
  posted_by = user_id
WHERE status IS NULL;