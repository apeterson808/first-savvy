/*
  # Add Vehicle and Auto Loan Support

  ## Overview
  This migration adds support for tracking vehicles as assets with optional auto loan financing.
  Users can create vehicles as owned assets or link them to auto loans. Asset-liability 
  relationships are fully editable after creation.

  ## Changes

  ### 1. Assets Table - Vehicle Columns
    - `vehicle_year` (integer, optional) - Year of vehicle manufacture
    - `vehicle_make` (text, optional) - Vehicle manufacturer (e.g., Toyota, Ford)
    - `vehicle_model` (text, optional) - Vehicle model name
    - `vehicle_type` (text, optional) - Type: Car, Truck, SUV, Motorcycle, etc.
    - `vin` (text, optional) - Vehicle Identification Number (17 characters)

  ### 2. Liabilities Table - Loan Columns
    - `original_loan_amount` (numeric, optional) - Initial loan principal amount
    - `loan_start_date` (date, optional) - Date loan was originated
    - `monthly_payment` (numeric, optional) - Regular monthly payment amount
    - `payment_due_date` (integer, optional) - Day of month payment is due (1-31)
    - `linked_asset_id` (uuid, optional) - Reference to linked asset for reverse lookup

  ### 3. Asset Liability Links Table
    - `id` (uuid, primary key)
    - `user_id` (uuid, not null) - Owner of the relationship
    - `asset_id` (uuid, not null) - Foreign key to assets table
    - `liability_id` (uuid, not null) - Foreign key to liabilities table
    - `relationship_type` (text, default 'secures') - Type of relationship
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
    - Enable RLS on asset_liability_links table
    - Users can only manage their own links
    - Prevent linking assets/liabilities from different users

  ## Indexes
    - Index on asset_id for link lookups
    - Index on liability_id for link lookups
    - Index on linked_asset_id in liabilities for reverse lookup
    - Unique constraint on (asset_id, liability_id) to prevent duplicates
*/

-- Add vehicle-specific columns to assets table
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS vehicle_year integer,
ADD COLUMN IF NOT EXISTS vehicle_make text,
ADD COLUMN IF NOT EXISTS vehicle_model text,
ADD COLUMN IF NOT EXISTS vehicle_type text,
ADD COLUMN IF NOT EXISTS vin text;

-- Add loan-specific columns to liabilities table
ALTER TABLE liabilities
ADD COLUMN IF NOT EXISTS original_loan_amount numeric(15,2),
ADD COLUMN IF NOT EXISTS loan_start_date date,
ADD COLUMN IF NOT EXISTS monthly_payment numeric(15,2),
ADD COLUMN IF NOT EXISTS payment_due_date integer,
ADD COLUMN IF NOT EXISTS linked_asset_id uuid REFERENCES assets(id) ON DELETE SET NULL;

-- Add check constraint for payment_due_date (1-31)
ALTER TABLE liabilities
ADD CONSTRAINT payment_due_date_valid CHECK (payment_due_date IS NULL OR (payment_due_date >= 1 AND payment_due_date <= 31));

-- Create asset_liability_links table
CREATE TABLE IF NOT EXISTS asset_liability_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  liability_id uuid NOT NULL REFERENCES liabilities(id) ON DELETE CASCADE,
  relationship_type text NOT NULL DEFAULT 'secures',
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create unique constraint to prevent duplicate links
CREATE UNIQUE INDEX IF NOT EXISTS idx_asset_liability_unique 
ON asset_liability_links(asset_id, liability_id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_asset_liability_links_asset_id 
ON asset_liability_links(asset_id);

CREATE INDEX IF NOT EXISTS idx_asset_liability_links_liability_id 
ON asset_liability_links(liability_id);

CREATE INDEX IF NOT EXISTS idx_asset_liability_links_user_id 
ON asset_liability_links(user_id);

CREATE INDEX IF NOT EXISTS idx_liabilities_linked_asset_id 
ON liabilities(linked_asset_id) WHERE linked_asset_id IS NOT NULL;

-- Enable RLS on asset_liability_links
ALTER TABLE asset_liability_links ENABLE ROW LEVEL SECURITY;

-- RLS Policies for asset_liability_links

-- Users can view their own links
CREATE POLICY "Users can view own asset liability links"
  ON asset_liability_links FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can create links for their own assets and liabilities
CREATE POLICY "Users can create own asset liability links"
  ON asset_liability_links FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (SELECT 1 FROM assets WHERE id = asset_id AND user_id = auth.uid())
    AND EXISTS (SELECT 1 FROM liabilities WHERE id = liability_id AND user_id = auth.uid())
  );

-- Users can update their own links
CREATE POLICY "Users can update own asset liability links"
  ON asset_liability_links FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own links
CREATE POLICY "Users can delete own asset liability links"
  ON asset_liability_links FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_asset_liability_links_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER asset_liability_links_updated_at
  BEFORE UPDATE ON asset_liability_links
  FOR EACH ROW
  EXECUTE FUNCTION update_asset_liability_links_updated_at();