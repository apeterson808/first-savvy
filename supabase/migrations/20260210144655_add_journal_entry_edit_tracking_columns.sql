/*
  # Add Edit Tracking to Journal Entries

  1. Changes
    - Add `edited_at` timestamp to track last edit time
    - Add `edited_by` UUID to track who made the last edit
    - Add `edit_count` integer to track number of edits (starts at 0)
  
  2. Purpose
    - Enable direct editing of journal entries instead of reversal-based undo
    - Maintain audit trail of when and who edited entries
    - Track edit frequency for reporting purposes
*/

-- Add edit tracking columns to journal_entries
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS edited_at timestamptz,
  ADD COLUMN IF NOT EXISTS edited_by uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS edit_count integer DEFAULT 0 NOT NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN journal_entries.edited_at IS 'Timestamp of last edit to this journal entry (NULL if never edited)';
COMMENT ON COLUMN journal_entries.edited_by IS 'User who last edited this journal entry (NULL if never edited)';
COMMENT ON COLUMN journal_entries.edit_count IS 'Number of times this journal entry has been edited (0 if never edited)';
