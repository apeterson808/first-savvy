/*
  # Create Protected Configurations System

  1. New Tables
    - `protected_configurations`
      - `id` (uuid, primary key)
      - `name` (text) - Name/identifier of the protected configuration
      - `description` (text) - Human-readable description
      - `version` (text) - Version number (e.g., "1.0.0")
      - `content_hash` (text) - SHA-256 hash for integrity checking
      - `configuration_data` (jsonb) - The actual configuration content
      - `file_paths` (jsonb) - Array of file paths this config protects
      - `is_locked` (boolean) - Whether changes require confirmation
      - `is_active` (boolean) - Whether this is the active baseline version
      - `created_by` (uuid) - User who created this version
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `configuration_change_log`
      - `id` (uuid, primary key)
      - `configuration_id` (uuid) - References protected_configurations
      - `user_id` (uuid) - User who made the change
      - `change_type` (text) - Type of change (update, restore, lock, unlock)
      - `old_version` (text)
      - `new_version` (text)
      - `change_description` (text)
      - `diff_data` (jsonb) - Detailed diff information
      - `confirmed_at` (timestamptz) - When user confirmed the change
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on both tables
    - Authenticated users can view all protected configurations
    - Only authenticated users can create/modify configurations
    - All changes are logged with user information

  3. Important Notes
    - This system provides version control for critical application components
    - The content_hash ensures integrity and detects unauthorized changes
    - All modifications require explicit user confirmation when is_locked is true
*/

-- Create protected_configurations table
CREATE TABLE IF NOT EXISTS protected_configurations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  version text NOT NULL DEFAULT '1.0.0',
  content_hash text NOT NULL,
  configuration_data jsonb NOT NULL,
  file_paths jsonb DEFAULT '[]'::jsonb,
  is_locked boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create configuration_change_log table
CREATE TABLE IF NOT EXISTS configuration_change_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  configuration_id uuid REFERENCES protected_configurations(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  change_type text NOT NULL,
  old_version text,
  new_version text,
  change_description text,
  diff_data jsonb,
  confirmed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE protected_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE configuration_change_log ENABLE ROW LEVEL SECURITY;

-- RLS Policies for protected_configurations
CREATE POLICY "Authenticated users can view protected configurations"
  ON protected_configurations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert protected configurations"
  ON protected_configurations FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Authenticated users can update protected configurations"
  ON protected_configurations FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Authenticated users can delete protected configurations"
  ON protected_configurations FOR DELETE
  TO authenticated
  USING (true);

-- RLS Policies for configuration_change_log
CREATE POLICY "Authenticated users can view change logs"
  ON configuration_change_log FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert change logs"
  ON configuration_change_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_protected_configurations_name ON protected_configurations(name);
CREATE INDEX IF NOT EXISTS idx_protected_configurations_is_active ON protected_configurations(is_active);
CREATE INDEX IF NOT EXISTS idx_configuration_change_log_config_id ON configuration_change_log(configuration_id);
CREATE INDEX IF NOT EXISTS idx_configuration_change_log_created_at ON configuration_change_log(created_at DESC);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_protected_configuration_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_protected_configurations_updated_at ON protected_configurations;
CREATE TRIGGER update_protected_configurations_updated_at
  BEFORE UPDATE ON protected_configurations
  FOR EACH ROW
  EXECUTE FUNCTION update_protected_configuration_timestamp();