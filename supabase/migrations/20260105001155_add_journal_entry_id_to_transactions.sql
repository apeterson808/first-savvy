/*
  # Add journal_entry_id to transactions table

  1. Changes
    - Add `journal_entry_id` column to transactions table
    - Nullable to support both regular transactions and journal-entry-backed transactions
    - Foreign key to journal_entries with SET NULL on delete
    - Index for performance
  
  2. Purpose
    - Link special transactions (opening balances, adjustments) to journal entries
    - Regular bank transactions continue as is (implicit journal entries)
    - Allows gradual migration to full journal entry system
*/

-- Add journal_entry_id column to transactions
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS journal_entry_id uuid REFERENCES journal_entries(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_transactions_journal_entry_id ON transactions(journal_entry_id);

-- Add comment for documentation
COMMENT ON COLUMN transactions.journal_entry_id IS 'Links transaction to explicit journal entry for opening balances, adjustments, etc.';