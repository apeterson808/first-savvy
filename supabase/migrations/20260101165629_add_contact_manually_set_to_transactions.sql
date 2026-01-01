/*
  # Add contact tracking to transactions

  1. Changes
    - Add `contact_manually_set` column to transactions table
    - Set to true for all existing transactions with a contact_id
    - Add index for performance
  
  2. Purpose
    - Track which contacts were manually assigned by users
    - Enable learning from user's past contact assignments
    - Improve contact suggestions for similar transactions
*/

-- Add the contact_manually_set column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'contact_manually_set'
  ) THEN
    ALTER TABLE transactions ADD COLUMN contact_manually_set boolean DEFAULT false;
  END IF;
END $$;

-- Set to true for all existing transactions that have a contact assigned
UPDATE transactions 
SET contact_manually_set = true 
WHERE contact_id IS NOT NULL;

-- Add index for performance when filtering by this column
CREATE INDEX IF NOT EXISTS idx_transactions_contact_manually_set 
  ON transactions(contact_manually_set) 
  WHERE contact_manually_set = true;
