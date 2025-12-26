/*
  # Create Transfer Registry Table

  ## Overview
  Creates a registry system to track unmatched transfer transactions that can be
  automatically matched when corresponding accounts are added to the system.

  ## New Tables

  ### transfer_registry
  Stores pending transfer transactions waiting for matching accounts
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, references auth.users) - Owner of the transfer
  - `profile_id` (uuid, references user_profiles) - Profile context
  - `transaction_id` (uuid, references transactions) - Source transaction
  - `amount` (numeric) - Transfer amount (absolute value)
  - `transaction_date` (date) - Date of the transfer
  - `source_account_id` (uuid, references accounts) - Originating account
  - `source_account_type` (text) - Type of source account (checking, savings, credit)
  - `target_account_type` (text) - Expected type of target account
  - `description_pattern` (text) - Pattern for matching description
  - `is_matched` (boolean) - Whether a match has been found
  - `matched_transaction_id` (uuid) - ID of matched transaction when found
  - `created_at` (timestamptz) - Registry entry creation time
  - `matched_at` (timestamptz) - When the match was completed

  ## Security
  - Enable RLS on transfer_registry table
  - Users can only access their own registry entries
  - Policies for SELECT, INSERT, UPDATE operations
*/

CREATE TABLE IF NOT EXISTS transfer_registry (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE NOT NULL,
  transaction_id uuid REFERENCES transactions(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  transaction_date date NOT NULL,
  source_account_id uuid REFERENCES accounts(id) ON DELETE CASCADE,
  source_account_type text NOT NULL,
  target_account_type text NOT NULL,
  description_pattern text NOT NULL,
  is_matched boolean DEFAULT false,
  matched_transaction_id uuid REFERENCES transactions(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  matched_at timestamptz
);

ALTER TABLE transfer_registry ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own transfer registry entries"
  ON transfer_registry FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own transfer registry entries"
  ON transfer_registry FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own transfer registry entries"
  ON transfer_registry FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own transfer registry entries"
  ON transfer_registry FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transfer_registry_user_id
  ON transfer_registry(user_id);

CREATE INDEX IF NOT EXISTS idx_transfer_registry_profile_id
  ON transfer_registry(profile_id);

CREATE INDEX IF NOT EXISTS idx_transfer_registry_is_matched
  ON transfer_registry(is_matched)
  WHERE is_matched = false;

CREATE INDEX IF NOT EXISTS idx_transfer_registry_transaction_id
  ON transfer_registry(transaction_id);
