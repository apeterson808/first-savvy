/*
  # Create Color Schemes Table

  1. New Tables
    - `color_schemes`
      - `id` (uuid, primary key)
      - `name` (text) - Name of the color scheme
      - `colors` (jsonb) - Array of color objects with name, hex, and semantic mapping
      - `is_active` (boolean) - Whether this is the currently active scheme
      - `created_by` (uuid) - User who created the scheme
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `color_schemes` table
    - Add policies for authenticated users to read active schemes
    - Add policies for users to manage their own color schemes
*/

CREATE TABLE IF NOT EXISTS color_schemes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  colors jsonb NOT NULL,
  is_active boolean DEFAULT false,
  created_by uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index for active scheme lookups
CREATE INDEX IF NOT EXISTS idx_color_schemes_active ON color_schemes(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_color_schemes_created_by ON color_schemes(created_by);

-- Enable RLS
ALTER TABLE color_schemes ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can read active color schemes
CREATE POLICY "Anyone can read active color schemes"
  ON color_schemes FOR SELECT
  USING (is_active = true);

-- Policy: Authenticated users can read their own color schemes
CREATE POLICY "Users can read own color schemes"
  ON color_schemes FOR SELECT
  TO authenticated
  USING (created_by = auth.uid());

-- Policy: Authenticated users can insert their own color schemes
CREATE POLICY "Users can insert own color schemes"
  ON color_schemes FOR INSERT
  TO authenticated
  WITH CHECK (created_by = auth.uid());

-- Policy: Authenticated users can update their own color schemes
CREATE POLICY "Users can update own color schemes"
  ON color_schemes FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Policy: Authenticated users can delete their own color schemes
CREATE POLICY "Users can delete own color schemes"
  ON color_schemes FOR DELETE
  TO authenticated
  USING (created_by = auth.uid());

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_color_schemes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_update_color_schemes_updated_at ON color_schemes;
CREATE TRIGGER trigger_update_color_schemes_updated_at
  BEFORE UPDATE ON color_schemes
  FOR EACH ROW
  EXECUTE FUNCTION update_color_schemes_updated_at();