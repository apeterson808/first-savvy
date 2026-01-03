/*
  # Add Contact Connection and Invitation Tracking

  ## Overview
  This migration adds support for tracking whether contacts have platform accounts,
  connection status, and invitation management.

  ## 1. Changes to contacts table
  - Add `connection_status` (text) - Tracks connection state: not_checked, platform_user, invited, connected
  - Add `linked_user_id` (uuid) - References auth.users if contact has platform account
  - Add `invitation_id` (uuid) - References invitations table if invitation was sent
  - Add `last_account_check` (timestamptz) - Tracks when we last checked for platform account

  ## 2. Indexes
  - Add index on contacts.email for faster account lookups
  - Add index on contacts.phone for faster account lookups
  - Add index on contacts.connection_status for filtering
  - Add index on contacts.linked_user_id for join operations

  ## 3. Security
  All existing RLS policies remain in place. New columns follow same security model.
*/

-- Add new columns to contacts table
ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS connection_status text DEFAULT 'not_checked',
  ADD COLUMN IF NOT EXISTS linked_user_id uuid,
  ADD COLUMN IF NOT EXISTS invitation_id uuid REFERENCES invitations(id) ON DELETE SET NULL,
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

-- Update existing contacts to have not_checked status
UPDATE contacts 
SET connection_status = 'not_checked' 
WHERE connection_status IS NULL;