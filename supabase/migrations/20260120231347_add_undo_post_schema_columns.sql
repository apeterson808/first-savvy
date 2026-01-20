/*
  # Add Undo Post Schema Columns

  ## Summary
  Adds columns to support security-hardened undo post flow for tax-ready accounting.
  
  ## Changes to `transactions` table
  - `current_journal_entry_id`: Tracks the currently active journal entry
  - `original_journal_entry_id`: Tracks the first journal entry ever created for this transaction
  - `unposted_at`: Timestamp when transaction was unposted
  - `unposted_by`: User who unposted the transaction
  - `unposted_reversal_entry_id`: References the reversal journal entry created during undo
  - `unposted_reason`: Text reason for unposting
  
  ## Changes to `journal_entries` table
  - `reversed_by_entry_id`: Points to the reversal entry that reversed this entry
  - `reverses_entry_id`: Points to the original entry that this entry reverses
  
  ## Security
  - All foreign keys properly indexed
  - Columns nullable to support existing data
*/

-- Add new columns to transactions table
ALTER TABLE transactions 
  ADD COLUMN IF NOT EXISTS current_journal_entry_id UUID REFERENCES journal_entries(id),
  ADD COLUMN IF NOT EXISTS original_journal_entry_id UUID REFERENCES journal_entries(id),
  ADD COLUMN IF NOT EXISTS unposted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS unposted_by UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS unposted_reversal_entry_id UUID REFERENCES journal_entries(id),
  ADD COLUMN IF NOT EXISTS unposted_reason TEXT;

-- Add new columns to journal_entries table
ALTER TABLE journal_entries
  ADD COLUMN IF NOT EXISTS reversed_by_entry_id UUID REFERENCES journal_entries(id),
  ADD COLUMN IF NOT EXISTS reverses_entry_id UUID REFERENCES journal_entries(id);

-- Create indexes for foreign keys (performance)
CREATE INDEX IF NOT EXISTS idx_transactions_current_journal_entry 
  ON transactions(current_journal_entry_id);
  
CREATE INDEX IF NOT EXISTS idx_transactions_original_journal_entry 
  ON transactions(original_journal_entry_id);
  
CREATE INDEX IF NOT EXISTS idx_transactions_unposted_by 
  ON transactions(unposted_by);
  
CREATE INDEX IF NOT EXISTS idx_transactions_unposted_reversal_entry 
  ON transactions(unposted_reversal_entry_id);

CREATE INDEX IF NOT EXISTS idx_journal_entries_reversed_by 
  ON journal_entries(reversed_by_entry_id);
  
CREATE INDEX IF NOT EXISTS idx_journal_entries_reverses 
  ON journal_entries(reverses_entry_id);
