/*
  # Clean Up Journal Entries for Pending Transactions

  ## Problem
  Prior to the status gate fix, journal entries were incorrectly created for transactions
  with status='pending'. These need to be removed so that:
  1. Savvy Balance only reflects posted transactions
  2. Pending transactions are truly in "review" mode
  3. Journal entries are only created when users click "Post"

  ## Actions
  1. Delete journal entry lines for entries linked to pending transactions
  2. Delete the journal entries themselves
  3. Clear journal_entry_id from pending transactions
  4. Recalculate account balances (handled by existing balance trigger)

  ## Impact
  - All pending transactions will no longer have journal entries
  - Savvy Balance will decrease to reflect only posted transactions
  - Pending transactions visible in UI but not affecting accounting
*/

-- Step 1: Delete journal entry lines for journal entries linked to pending transactions
DELETE FROM journal_entry_lines
WHERE journal_entry_id IN (
  SELECT je.id
  FROM journal_entries je
  INNER JOIN transactions t ON t.journal_entry_id = je.id
  WHERE t.status = 'pending'
);

-- Step 2: Delete the journal entries themselves
DELETE FROM journal_entries
WHERE id IN (
  SELECT journal_entry_id
  FROM transactions
  WHERE status = 'pending'
    AND journal_entry_id IS NOT NULL
);

-- Step 3: Clear journal_entry_id from pending transactions
UPDATE transactions
SET journal_entry_id = NULL
WHERE status = 'pending'
  AND journal_entry_id IS NOT NULL;

-- Note: Account balances will be automatically recalculated by the balance update trigger
