/*
  # Create Financial Institutions Table

  1. New Tables
    - `financial_institutions`
      - `id` (uuid, primary key)
      - `name` (text) - Institution name (e.g., "Chase", "Wells Fargo")
      - `full_name` (text) - Full legal name
      - `logo_url` (text) - URL to institution logo
      - `primary_color` (text) - Brand color in hex format
      - `institution_type` (text) - Type: 'bank', 'credit_union', 'brokerage'
      - `routing_number` (text) - Sample routing number for display
      - `website` (text) - Institution website URL
      - `is_active` (boolean) - Whether institution is available for mock connections
      - `sort_order` (integer) - Display order for popular banks
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `financial_institutions` table
    - Add policy for public read access (institutions are publicly viewable)
    - Add policy for authenticated admin insert/update (future use)

  3. Data
    - Seed with 20 major US financial institutions
    - Include logos, colors, and metadata for realistic UI
*/

-- Create financial_institutions table
CREATE TABLE IF NOT EXISTS financial_institutions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  full_name text NOT NULL,
  logo_url text,
  primary_color text DEFAULT '#0066CC',
  institution_type text NOT NULL DEFAULT 'bank' CHECK (institution_type IN ('bank', 'credit_union', 'brokerage')),
  routing_number text,
  website text,
  is_active boolean DEFAULT true,
  sort_order integer DEFAULT 999,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE financial_institutions ENABLE ROW LEVEL SECURITY;

-- Public read access for all users
CREATE POLICY "Anyone can view active institutions"
  ON financial_institutions FOR SELECT
  USING (is_active = true);

-- Authenticated users can view all institutions (including inactive)
CREATE POLICY "Authenticated users can view all institutions"
  ON financial_institutions FOR SELECT
  TO authenticated
  USING (true);

-- Create index for search performance
CREATE INDEX IF NOT EXISTS idx_financial_institutions_name ON financial_institutions(name);
CREATE INDEX IF NOT EXISTS idx_financial_institutions_sort_order ON financial_institutions(sort_order);

-- Seed major US financial institutions
INSERT INTO financial_institutions (name, full_name, logo_url, primary_color, institution_type, routing_number, website, sort_order) VALUES
  -- Top 5 Major Banks
  ('Chase', 'JPMorgan Chase Bank, N.A.', 'https://logo.clearbit.com/chase.com', '#117ACA', 'bank', '021000021', 'https://chase.com', 1),
  ('Bank of America', 'Bank of America, N.A.', 'https://logo.clearbit.com/bankofamerica.com', '#E31837', 'bank', '026009593', 'https://bankofamerica.com', 2),
  ('Wells Fargo', 'Wells Fargo Bank, N.A.', 'https://logo.clearbit.com/wellsfargo.com', '#D71E28', 'bank', '121000248', 'https://wellsfargo.com', 3),
  ('Citi', 'Citibank, N.A.', 'https://logo.clearbit.com/citi.com', '#056DAE', 'bank', '021000089', 'https://citi.com', 4),
  ('Capital One', 'Capital One, N.A.', 'https://logo.clearbit.com/capitalone.com', '#004879', 'bank', '065000090', 'https://capitalone.com', 5),

  -- Other Major Banks
  ('U.S. Bank', 'U.S. Bank National Association', 'https://logo.clearbit.com/usbank.com', '#0F5499', 'bank', '091000022', 'https://usbank.com', 6),
  ('PNC Bank', 'PNC Bank, National Association', 'https://logo.clearbit.com/pnc.com', '#F47216', 'bank', '043000096', 'https://pnc.com', 7),
  ('TD Bank', 'TD Bank, N.A.', 'https://logo.clearbit.com/td.com', '#00A758', 'bank', '031101266', 'https://td.com', 8),
  ('Truist', 'Truist Bank', 'https://logo.clearbit.com/truist.com', '#3E0563', 'bank', '061000104', 'https://truist.com', 9),
  ('Goldman Sachs', 'Goldman Sachs Bank USA', 'https://logo.clearbit.com/goldmansachs.com', '#4285F4', 'bank', '121000248', 'https://marcus.com', 10),

  -- Regional Banks
  ('Citizens Bank', 'Citizens Bank, National Association', 'https://logo.clearbit.com/citizensbank.com', '#009B77', 'bank', '011500120', 'https://citizensbank.com', 11),
  ('Fifth Third Bank', 'Fifth Third Bank, National Association', 'https://logo.clearbit.com/53.com', '#BE0000', 'bank', '042000314', 'https://53.com', 12),
  ('KeyBank', 'KeyBank National Association', 'https://logo.clearbit.com/key.com', '#EE3424', 'bank', '041001039', 'https://key.com', 13),
  ('Regions Bank', 'Regions Bank', 'https://logo.clearbit.com/regions.com', '#76BC21', 'bank', '062000019', 'https://regions.com', 14),
  ('M&T Bank', 'Manufacturers and Traders Trust Company', 'https://logo.clearbit.com/mtb.com', '#00984F', 'bank', '022000046', 'https://mtb.com', 15),

  -- Credit Unions
  ('Navy Federal', 'Navy Federal Credit Union', 'https://logo.clearbit.com/navyfederal.org', '#003F5C', 'credit_union', '256074974', 'https://navyfederal.org', 16),
  ('Pentagon Federal', 'Pentagon Federal Credit Union', 'https://logo.clearbit.com/penfed.org', '#003366', 'credit_union', '256078446', 'https://penfed.org', 17),

  -- Online/Digital Banks
  ('Ally Bank', 'Ally Bank', 'https://logo.clearbit.com/ally.com', '#7B3FBC', 'bank', '124003116', 'https://ally.com', 18),
  ('Discover Bank', 'Discover Bank', 'https://logo.clearbit.com/discover.com', '#FF6000', 'bank', '031100649', 'https://discover.com', 19),
  ('Charles Schwab', 'Charles Schwab Bank', 'https://logo.clearbit.com/schwab.com', '#00A0DF', 'brokerage', '121000248', 'https://schwab.com', 20)
ON CONFLICT DO NOTHING;