/*
  # Protect System Equity Accounts from Modification

  1. Purpose
    - Prevent all edits and deletions to system accounts 3000 (Opening Balance Equity) and 3200 (Net Worth Adjustment)
    - These accounts are critical for system balance calculations and must remain unmodified
    - Balances can still change through transactions, but direct account modifications are blocked

  2. Changes
    - Create trigger function to block UPDATE operations on system accounts 3000 and 3200
    - Create trigger function to block DELETE operations on system accounts 3000 and 3200
    - Apply triggers to user_chart_of_accounts table
    - Add RLS policies to reinforce protection at security level

  3. Security
    - Triggers will reject any attempt to modify or delete system accounts with clear error messages
    - RLS policies provide additional layer of protection
    - System can still update balances through transaction processing
*/

-- Function to prevent updates to system accounts
CREATE OR REPLACE FUNCTION prevent_system_account_updates()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.template_account_number IN (3000, 3200) THEN
    RAISE EXCEPTION 'System accounts (3000, 3200) cannot be modified';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to prevent deletion of system accounts
CREATE OR REPLACE FUNCTION prevent_system_account_deletes()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.template_account_number IN (3000, 3200) THEN
    RAISE EXCEPTION 'System accounts (3000, 3200) cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS block_system_account_updates ON user_chart_of_accounts;
DROP TRIGGER IF EXISTS block_system_account_deletes ON user_chart_of_accounts;

-- Create triggers on user_chart_of_accounts
CREATE TRIGGER block_system_account_updates
  BEFORE UPDATE ON user_chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_system_account_updates();

CREATE TRIGGER block_system_account_deletes
  BEFORE DELETE ON user_chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION prevent_system_account_deletes();

-- Add RLS policy to prevent updates to system accounts
DROP POLICY IF EXISTS "Block updates to system accounts" ON user_chart_of_accounts;
CREATE POLICY "Block updates to system accounts"
  ON user_chart_of_accounts
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (template_account_number NOT IN (3000, 3200));

-- Add RLS policy to prevent deletes to system accounts
DROP POLICY IF EXISTS "Block deletes to system accounts" ON user_chart_of_accounts;
CREATE POLICY "Block deletes to system accounts"
  ON user_chart_of_accounts
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (template_account_number NOT IN (3000, 3200));
