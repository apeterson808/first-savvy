/*
  # Add Missing Columns to Contacts Table

  ## Overview
  Adds columns that were missing after database reset to support contact management features.

  ## 1. New Columns
    - `status` (text) - Contact status: active, inactive, archived (default: 'active')
    - `address` (text) - Contact's physical address
    - `default_category_id` (uuid) - Default category for transactions with this contact
    - `connection_status` (text) - Connection state: not_checked, platform_user, invited, connected
    - `linked_user_id` (uuid) - References auth.users if contact has platform account
    - `invitation_id` (uuid) - References invitations table if invitation was sent
    - `last_account_check` (timestamptz) - When we last checked for platform account

  ## 2. Indexes
    - Add index on contacts.email for faster account lookups
    - Add index on contacts.phone for faster account lookups
    - Add index on contacts.connection_status for filtering
    - Add index on contacts.linked_user_id for join operations

  ## 3. Security
    All existing RLS policies remain in place
*/

-- Add missing columns to contacts table
ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS default_category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS connection_status text DEFAULT 'not_checked',
  ADD COLUMN IF NOT EXISTS linked_user_id uuid,
  ADD COLUMN IF NOT EXISTS invitation_id uuid,
  ADD COLUMN IF NOT EXISTS last_account_check timestamptz;

-- Add constraint for connection_status values
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contacts_connection_status_check'
  ) THEN
    ALTER TABLE contacts 
      ADD CONSTRAINT contacts_connection_status_check 
      CHECK (connection_status IN ('not_checked', 'platform_user', 'invited', 'connected'));
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contacts_email ON contacts(email) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_phone ON contacts(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_contacts_connection_status ON contacts(connection_status);
CREATE INDEX IF NOT EXISTS idx_contacts_linked_user_id ON contacts(linked_user_id) WHERE linked_user_id IS NOT NULL;

-- Update existing contacts to have active status and not_checked connection status
UPDATE contacts 
SET 
  status = COALESCE(status, 'active'),
  connection_status = COALESCE(connection_status, 'not_checked')
WHERE status IS NULL OR connection_status IS NULL;