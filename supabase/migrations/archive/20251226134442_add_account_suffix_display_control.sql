/*
  # Add Account Suffix Display Control

  1. Changes to `accounts` table
    - Add `external_account_suffix` (text, nullable) - stores last 4 digits from external sources (Plaid)
    - Add `show_account_suffix` (boolean NOT NULL DEFAULT true) - controls whether suffix is displayed in UI
  
  2. Purpose
    - Separate storage of account suffix from account_name (no concatenation)
    - User control over suffix visibility
    - account_name stores only user's typed input, never modified
    - Suffix formatted as (••1234) when displayed
  
  3. Security Notes
    - Never use last4 alone for account matching (use plaid_account_id)
    - Never display full account numbers in UI
    - Only display last 4 digits with masking (••1234)
  
  4. Backward Compatibility
    - Existing accounts continue working normally
    - account_number_last4 maintained for legacy support
    - show_account_suffix defaults to true for all accounts
*/

-- Add external_account_suffix column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'external_account_suffix'
  ) THEN
    ALTER TABLE accounts ADD COLUMN external_account_suffix text;
    COMMENT ON COLUMN accounts.external_account_suffix IS 'External account suffix (last 4 digits) displayed when show_account_suffix is true';
  END IF;
END $$;

-- Add show_account_suffix column if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'show_account_suffix'
  ) THEN
    ALTER TABLE accounts ADD COLUMN show_account_suffix boolean NOT NULL DEFAULT true;
    COMMENT ON COLUMN accounts.show_account_suffix IS 'Controls whether external_account_suffix is displayed in UI';
  END IF;
END $$;