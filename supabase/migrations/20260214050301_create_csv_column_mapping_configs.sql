/*
  # CSV Column Mapping Memory

  1. New Tables
    - `csv_column_mapping_configs`
      - `id` (uuid, primary key)
      - `profile_id` (uuid, foreign key to profiles)
      - `institution_name` (text) - Bank or institution identifier
      - `column_mappings` (jsonb) - Stores the column mapping configuration
      - `date_format` (text) - Date format preference
      - `amount_type` (text) - Amount type (auto, separate_columns, etc.)
      - `debit_column` (text) - Debit column name
      - `credit_column` (text) - Credit column name
      - `balance_column` (text) - Balance column name
      - `use_count` (integer) - Number of times this mapping has been used
      - `last_used_at` (timestamptz) - Last time this mapping was used
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `csv_column_mapping_configs` table
    - Add policies for authenticated users to manage their own mappings

  3. Purpose
    - Remembers CSV column mappings so users don't have to reconfigure every time
    - Matches based on institution name or file pattern
    - Tracks usage to prefer most frequently used mappings
*/

CREATE TABLE IF NOT EXISTS csv_column_mapping_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  institution_name text NOT NULL,
  column_mappings jsonb NOT NULL DEFAULT '{}'::jsonb,
  date_format text DEFAULT 'auto',
  amount_type text DEFAULT 'auto' CHECK (amount_type IN ('auto', 'separate_columns', 'always_expense', 'always_income')),
  debit_column text DEFAULT '',
  credit_column text DEFAULT '',
  balance_column text DEFAULT '',
  use_count integer DEFAULT 1,
  last_used_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE csv_column_mapping_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own CSV mapping configs"
  ON csv_column_mapping_configs
  FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own CSV mapping configs"
  ON csv_column_mapping_configs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own CSV mapping configs"
  ON csv_column_mapping_configs
  FOR UPDATE
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own CSV mapping configs"
  ON csv_column_mapping_configs
  FOR DELETE
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_csv_column_mapping_configs_profile_id 
  ON csv_column_mapping_configs(profile_id);

CREATE INDEX IF NOT EXISTS idx_csv_column_mapping_configs_institution 
  ON csv_column_mapping_configs(profile_id, institution_name);

COMMENT ON TABLE csv_column_mapping_configs IS 'Stores user CSV column mapping preferences to avoid reconfiguring every import';
COMMENT ON COLUMN csv_column_mapping_configs.institution_name IS 'Bank or institution identifier to match against';
COMMENT ON COLUMN csv_column_mapping_configs.column_mappings IS 'JSON object storing date, description, amount, type, category column mappings';
COMMENT ON COLUMN csv_column_mapping_configs.use_count IS 'Number of times this mapping has been used (higher = more trusted)';
