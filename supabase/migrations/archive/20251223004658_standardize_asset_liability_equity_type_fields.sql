/*
  # Standardize Type and Detail Type Fields for Assets, Liabilities, and Equity

  ## Overview
  This migration standardizes the type system across assets, liabilities, and equity tables,
  introducing a consistent `detail_type` field similar to the accounts table pattern.

  ## Changes Made

  ### 1. Assets Table
  - Add `detail_type` column (lowercase, snake_case identifiers)
  - Migrate existing type values to detail_type:
    - 'Vehicle' → detail_type: 'vehicle', type: 'Asset'
    - 'Property' → detail_type: 'property', type: 'Asset'
    - 'stocks' → detail_type: 'stocks', type: 'Asset'
  - Standardize `type` column to always be 'Asset'
  - Add check constraint on detail_type for known values

  ### 2. Liabilities Table
  - Add `detail_type` column
  - Migrate existing type values:
    - 'Auto Loan' → detail_type: 'auto_loan', type: 'Liability'
    - 'Mortgage' → detail_type: 'mortgage', type: 'Liability'
  - Standardize `type` column to always be 'Liability'
  - Add check constraint on detail_type for known values

  ### 3. Equity Table
  - Add `detail_type` column
  - Populate detail_type with lowercase version of existing type values
  - Standardize `type` column to always be 'Equity'
  - Add check constraint on detail_type for known values

  ### 4. Indexes
  - Create index on assets(detail_type) for filtering
  - Create index on liabilities(detail_type) for filtering
  - Create index on equity(detail_type) for filtering

  ## Security
  - No RLS changes needed - existing policies continue to work
*/

-- ============================================================================
-- STEP 1: Add detail_type columns to all three tables
-- ============================================================================

ALTER TABLE assets ADD COLUMN IF NOT EXISTS detail_type text;
ALTER TABLE liabilities ADD COLUMN IF NOT EXISTS detail_type text;
ALTER TABLE equity ADD COLUMN IF NOT EXISTS detail_type text;

-- ============================================================================
-- STEP 2: Migrate existing data to populate detail_type
-- ============================================================================

-- Migrate assets type values to detail_type
UPDATE assets SET detail_type =
  CASE
    WHEN type = 'Vehicle' THEN 'vehicle'
    WHEN type = 'Property' THEN 'property'
    WHEN type = 'Real Estate' THEN 'property'
    WHEN type = 'stocks' THEN 'stocks'
    WHEN type = 'Investment' THEN 'investment'
    WHEN type = 'Cash' THEN 'cash'
    WHEN type = 'Savings' THEN 'savings'
    WHEN type = 'Retirement' THEN 'retirement'
    WHEN type = 'Brokerage' THEN 'brokerage'
    WHEN type = 'Other' THEN 'other'
    WHEN type IS NOT NULL THEN lower(regexp_replace(type, '\s+', '_', 'g'))
    ELSE 'other'
  END
WHERE detail_type IS NULL;

-- Standardize assets type column to 'Asset'
UPDATE assets SET type = 'Asset' WHERE type IS NULL OR type != 'Asset';

-- Migrate liabilities type values to detail_type
UPDATE liabilities SET detail_type =
  CASE
    WHEN type = 'Auto Loan' THEN 'auto_loan'
    WHEN type = 'Mortgage' THEN 'mortgage'
    WHEN type = 'Credit Card' THEN 'credit_card'
    WHEN type = 'Personal Loan' THEN 'personal_loan'
    WHEN type = 'Student Loan' THEN 'student_loan'
    WHEN type = 'Business Loan' THEN 'business_loan'
    WHEN type = 'Line of Credit' THEN 'line_of_credit'
    WHEN type = 'Other' THEN 'other'
    WHEN type IS NOT NULL THEN lower(regexp_replace(type, '\s+', '_', 'g'))
    ELSE 'other'
  END
WHERE detail_type IS NULL;

-- Standardize liabilities type column to 'Liability'
UPDATE liabilities SET type = 'Liability' WHERE type IS NULL OR type != 'Liability';

-- Migrate equity type values to detail_type
UPDATE equity SET detail_type =
  CASE
    WHEN type = 'Owner''s Equity' THEN 'owners_equity'
    WHEN type = 'Retained Earnings' THEN 'retained_earnings'
    WHEN type = 'Common Stock' THEN 'common_stock'
    WHEN type = 'Preferred Stock' THEN 'preferred_stock'
    WHEN type = 'Personal Equity' THEN 'personal_equity'
    WHEN type = 'Home Equity' THEN 'home_equity'
    WHEN type = 'Other' THEN 'other'
    WHEN type IS NOT NULL THEN lower(regexp_replace(type, '\s+', '_', 'g'))
    ELSE 'other'
  END
WHERE detail_type IS NULL;

-- Standardize equity type column to 'Equity'
UPDATE equity SET type = 'Equity' WHERE type IS NULL OR type != 'Equity';

-- ============================================================================
-- STEP 3: Add constraints to enforce data integrity
-- ============================================================================

-- Make detail_type NOT NULL after populating
ALTER TABLE assets ALTER COLUMN detail_type SET NOT NULL;
ALTER TABLE liabilities ALTER COLUMN detail_type SET NOT NULL;
ALTER TABLE equity ALTER COLUMN detail_type SET NOT NULL;

-- Make type NOT NULL and set defaults
ALTER TABLE assets
ALTER COLUMN type SET NOT NULL,
ALTER COLUMN type SET DEFAULT 'Asset';

ALTER TABLE liabilities
ALTER COLUMN type SET NOT NULL,
ALTER COLUMN type SET DEFAULT 'Liability';

ALTER TABLE equity
ALTER COLUMN type SET NOT NULL,
ALTER COLUMN type SET DEFAULT 'Equity';

-- Add check constraints for type columns
ALTER TABLE assets
DROP CONSTRAINT IF EXISTS assets_type_check,
ADD CONSTRAINT assets_type_check CHECK (type = 'Asset');

ALTER TABLE liabilities
DROP CONSTRAINT IF EXISTS liabilities_type_check,
ADD CONSTRAINT liabilities_type_check CHECK (type = 'Liability');

ALTER TABLE equity
DROP CONSTRAINT IF EXISTS equity_type_check,
ADD CONSTRAINT equity_type_check CHECK (type = 'Equity');

-- Add check constraints for detail_type with known values
ALTER TABLE assets
DROP CONSTRAINT IF EXISTS assets_detail_type_check,
ADD CONSTRAINT assets_detail_type_check CHECK (detail_type IN (
  'vehicle', 'property', 'stocks', 'investment', 'cash', 'savings',
  'retirement', 'brokerage', 'checking', 'other'
));

ALTER TABLE liabilities
DROP CONSTRAINT IF EXISTS liabilities_detail_type_check,
ADD CONSTRAINT liabilities_detail_type_check CHECK (detail_type IN (
  'auto_loan', 'mortgage', 'credit_card', 'personal_loan',
  'student_loan', 'business_loan', 'line_of_credit', 'other'
));

ALTER TABLE equity
DROP CONSTRAINT IF EXISTS equity_detail_type_check,
ADD CONSTRAINT equity_detail_type_check CHECK (detail_type IN (
  'owners_equity', 'partner_capital', 'common_stock', 'preferred_stock',
  'paid_in_capital', 'retained_earnings', 'current_year_earnings',
  'owners_draw', 'partner_distributions', 'dividends_paid',
  'treasury_stock', 'opening_balance_equity', 'accumulated_adjustment',
  'personal_equity', 'home_equity', 'other'
));

-- ============================================================================
-- STEP 4: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_assets_detail_type ON assets(detail_type);
CREATE INDEX IF NOT EXISTS idx_liabilities_detail_type ON liabilities(detail_type);
CREATE INDEX IF NOT EXISTS idx_equity_detail_type ON equity(detail_type);

CREATE INDEX IF NOT EXISTS idx_assets_user_detail_type ON assets(user_id, detail_type);
CREATE INDEX IF NOT EXISTS idx_liabilities_user_detail_type ON liabilities(user_id, detail_type);
CREATE INDEX IF NOT EXISTS idx_equity_user_detail_type ON equity(user_id, detail_type);
