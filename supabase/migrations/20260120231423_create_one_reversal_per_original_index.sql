/*
  # Create One Reversal Per Original Index

  ## Summary
  Ensures each journal entry can only be reversed once (data integrity).
  
  ## Index Created
  - Unique index on `journal_entries(reverses_entry_id)` where not null
  - Prevents multiple reversals of the same original entry
  
  ## Business Rule
  - Once a journal entry is reversed, it cannot be reversed again
  - This prevents duplicate reversals and maintains clean audit trail
  - Re-posting creates a NEW entry (not another reversal)
  
  ## Security
  - Database-enforced constraint (cannot be bypassed by application code)
*/

-- Create unique index to ensure one reversal per original journal entry
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_reversal_per_original
  ON journal_entries(reverses_entry_id)
  WHERE reverses_entry_id IS NOT NULL;
