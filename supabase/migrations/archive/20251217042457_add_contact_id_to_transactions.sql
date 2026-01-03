/*
  # Add contact_id column to transactions

  1. Changes
    - Add `contact_id` column to `transactions` table to track the contact associated with each transaction
    - Add foreign key constraint to ensure referential integrity with the contacts table
    - Add index on contact_id for better query performance

  2. Purpose
    - Allows users to track which contact (person or business) is associated with each transaction
    - Enables filtering and reporting by contact
    - Supports the "From/To" column in the transactions table
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'contact_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN contact_id uuid REFERENCES contacts(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_transactions_contact_id ON transactions(contact_id);
  END IF;
END $$;