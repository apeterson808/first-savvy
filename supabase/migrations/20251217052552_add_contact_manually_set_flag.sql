/*
  # Add contact manual modification tracking

  1. Changes
    - Add `contact_manually_set` column to transactions table
    - Defaults to false for new transactions
    - Set to true when user manually changes or clears a contact
  
  2. Purpose
    - Track whether a user has manually modified the contact field
    - Prevent auto-fill from overriding user choices
    - Allow one-time auto-fill on transaction upload
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'contact_manually_set'
  ) THEN
    ALTER TABLE transactions ADD COLUMN contact_manually_set boolean DEFAULT false;
  END IF;
END $$;