/*
  # Create Plaid Items Table

  1. New Tables
    - `plaid_items`
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to auth.users)
      - `item_id` (text, unique) - Plaid item ID
      - `access_token` (text) - Plaid access token (encrypted at rest)
      - `institution_id` (text) - Plaid institution ID
      - `institution_name` (text) - Human-readable institution name
      - `last_synced_at` (timestamptz) - Last successful sync timestamp
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `plaid_items` table
    - Add policies for authenticated users to manage their own items

  3. Performance
    - Add index on user_id for query performance
    - Add unique constraint on item_id to prevent duplicates
*/

CREATE TABLE IF NOT EXISTS plaid_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id text NOT NULL UNIQUE,
  access_token text NOT NULL,
  institution_id text NOT NULL,
  institution_name text NOT NULL,
  last_synced_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own Plaid items"
  ON plaid_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own Plaid items"
  ON plaid_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own Plaid items"
  ON plaid_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own Plaid items"
  ON plaid_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_plaid_items_user_id ON plaid_items(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_item_id ON plaid_items(item_id);