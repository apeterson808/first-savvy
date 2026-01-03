/*
  # Add Webhook Support to Plaid Items

  1. Changes
    - Add `sync_required` boolean column to track when transactions need syncing
    - Add `error_message` text column to store error details
    - Add index on `sync_required` for efficient querying of items needing sync

  2. Purpose
    - Enable webhook-driven transaction syncing
    - Track item errors and status changes from Plaid webhooks
*/

-- Add columns for webhook support
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plaid_items' AND column_name = 'sync_required'
  ) THEN
    ALTER TABLE plaid_items ADD COLUMN sync_required boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'plaid_items' AND column_name = 'error_message'
  ) THEN
    ALTER TABLE plaid_items ADD COLUMN error_message text;
  END IF;
END $$;

-- Create index for efficient querying of items needing sync
CREATE INDEX IF NOT EXISTS idx_plaid_items_sync_required 
  ON plaid_items(sync_required) 
  WHERE sync_required = true;
