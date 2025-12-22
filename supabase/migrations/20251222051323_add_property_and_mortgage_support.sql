/*
  # Add Property and Mortgage Support

  ## Overview
  This migration adds support for tracking properties (real estate) as assets with optional 
  mortgage financing. Users can create properties as owned assets or link them to mortgages.
  Asset-liability relationships are fully editable after creation.

  ## Changes

  ### 1. Assets Table - Property Columns
    - `property_address` (text, optional) - Full street address
    - `property_city` (text, optional) - City name
    - `property_state` (text, optional) - State/province
    - `property_zip` (text, optional) - Postal/ZIP code
    - `property_type` (text, optional) - Type: Single Family, Condo, Townhouse, etc.
    - `property_square_feet` (integer, optional) - Property size in square feet
    - `property_bedrooms` (numeric(3,1), optional) - Number of bedrooms
    - `property_bathrooms` (numeric(3,1), optional) - Number of bathrooms
    - `property_purchase_price` (numeric(15,2), optional) - Original purchase price
    - `property_purchase_date` (date, optional) - Date property was purchased

  ### 2. Property Types Supported
    - Single Family
    - Condo
    - Townhouse
    - Multi-Family
    - Commercial
    - Land
    - Other

  ## Security
    - All property columns added to existing assets table with RLS already enabled
    - No new RLS policies needed - existing policies apply

  ## Indexes
    - Index on property_zip for location-based queries
    - Index on property_type for filtering by property type
*/

-- Add property-specific columns to assets table
ALTER TABLE assets 
ADD COLUMN IF NOT EXISTS property_address text,
ADD COLUMN IF NOT EXISTS property_city text,
ADD COLUMN IF NOT EXISTS property_state text,
ADD COLUMN IF NOT EXISTS property_zip text,
ADD COLUMN IF NOT EXISTS property_type text,
ADD COLUMN IF NOT EXISTS property_square_feet integer,
ADD COLUMN IF NOT EXISTS property_bedrooms numeric(3,1),
ADD COLUMN IF NOT EXISTS property_bathrooms numeric(3,1),
ADD COLUMN IF NOT EXISTS property_purchase_price numeric(15,2),
ADD COLUMN IF NOT EXISTS property_purchase_date date;

-- Create indexes for property queries
CREATE INDEX IF NOT EXISTS idx_assets_property_zip 
ON assets(property_zip) WHERE property_zip IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assets_property_type 
ON assets(property_type) WHERE property_type IS NOT NULL;

-- Add check constraint for bedrooms and bathrooms (must be positive)
ALTER TABLE assets
ADD CONSTRAINT property_bedrooms_positive CHECK (property_bedrooms IS NULL OR property_bedrooms >= 0);

ALTER TABLE assets
ADD CONSTRAINT property_bathrooms_positive CHECK (property_bathrooms IS NULL OR property_bathrooms >= 0);

ALTER TABLE assets
ADD CONSTRAINT property_square_feet_positive CHECK (property_square_feet IS NULL OR property_square_feet > 0);