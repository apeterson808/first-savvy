/*
  # Create Plaid Integration Tables

  1. New Tables
    - `plaid_items`
      - `id` (uuid, primary key) - unique identifier
      - `profile_id` (uuid, FK to profiles) - owning profile
      - `access_token` (text) - encrypted Plaid access token
      - `item_id` (text) - Plaid item ID
      - `institution_id` (text) - Plaid institution ID
      - `institution_name` (text) - display name of the bank
      - `transactions_cursor` (text) - cursor for incremental transaction sync
      - `consent_expiration_time` (timestamptz) - when Plaid consent expires
      - `error_code` (text) - last Plaid error code if any
      - `error_message` (text) - last Plaid error message if any
      - `last_synced_at` (timestamptz) - last successful transaction sync
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Modified Tables
    - `user_chart_of_accounts`
      - Added `plaid_item_id` (uuid, FK to plaid_items) - links account to a Plaid connection
      - Added `plaid_account_id` (text) - Plaid's unique account ID

  3. Security
    - Enable RLS on `plaid_items`
    - Policies for authenticated users to manage their own Plaid connections via profile membership
    - Index on profile_id for query performance
    - Unique constraint on (profile_id, item_id) to prevent duplicate connections

  4. Important Notes
    - access_token contains sensitive credentials and should never be exposed to the frontend
    - The transactions_cursor enables incremental sync to avoid re-fetching all transactions
    - error_code/error_message track Plaid ITEM_ERROR states for re-authentication flows
*/

CREATE TABLE IF NOT EXISTS plaid_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  access_token text NOT NULL,
  item_id text NOT NULL,
  institution_id text,
  institution_name text,
  transactions_cursor text,
  consent_expiration_time timestamptz,
  error_code text,
  error_message text,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT plaid_items_profile_item_unique UNIQUE (profile_id, item_id)
);

ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own Plaid items via profile membership"
  ON plaid_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profile_memberships pm
      WHERE pm.profile_id = plaid_items.profile_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert Plaid items for own profiles"
  ON plaid_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profile_memberships pm
      WHERE pm.profile_id = plaid_items.profile_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own Plaid items via profile membership"
  ON plaid_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profile_memberships pm
      WHERE pm.profile_id = plaid_items.profile_id
      AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profile_memberships pm
      WHERE pm.profile_id = plaid_items.profile_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own Plaid items via profile membership"
  ON plaid_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profile_memberships pm
      WHERE pm.profile_id = plaid_items.profile_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_plaid_items_profile_id ON plaid_items(profile_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_chart_of_accounts' AND column_name = 'plaid_item_id'
  ) THEN
    ALTER TABLE user_chart_of_accounts ADD COLUMN plaid_item_id uuid REFERENCES plaid_items(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_chart_of_accounts' AND column_name = 'plaid_account_id'
  ) THEN
    ALTER TABLE user_chart_of_accounts ADD COLUMN plaid_account_id text;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_chart_of_accounts_plaid_item_id ON user_chart_of_accounts(plaid_item_id);
CREATE INDEX IF NOT EXISTS idx_user_chart_of_accounts_plaid_account_id ON user_chart_of_accounts(plaid_account_id);
