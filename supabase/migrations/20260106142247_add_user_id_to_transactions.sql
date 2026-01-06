/*
  # Add user_id to transactions table
  
  ## Overview
  The journal entry trigger requires user_id from transactions, but the column
  doesn't exist. This adds it.

  ## Changes
  1. Add user_id column to transactions (nullable, references auth.users)
  2. Backfill user_id from profile_id -> profiles -> user_id
  3. Add foreign key constraint
  4. Add index for performance
*/

-- Add user_id column (nullable initially for backfill)
ALTER TABLE transactions
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Backfill user_id from profile_id
UPDATE transactions t
SET user_id = p.user_id
FROM profiles p
WHERE t.profile_id = p.id
AND t.user_id IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);

-- Add comment
COMMENT ON COLUMN transactions.user_id IS 'Reference to the user who owns this transaction (used by journal entry trigger)';
