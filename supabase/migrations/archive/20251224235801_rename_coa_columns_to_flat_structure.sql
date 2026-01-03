/*
  # Rename COA Columns to Match FINAL COA Structure (Flat)

  ## Overview
  Renames columns in chart_of_accounts_templates and user_chart_of_accounts
  to match the FINAL COA structure exactly. Removes hierarchy columns.

  ## Changes to chart_of_accounts_templates
  - Rename account_type → class
  - Rename category → account_type
  - Rename display_name_default → display_name
  - Drop level, parent_account_number, number_range_start, number_range_end

  ## Changes to user_chart_of_accounts
  - Rename account_type → class
  - Rename category → account_type
  - Rename custom_display_name → display_name
  - Drop level, parent_account_number

  ## Safety
  - All data already truncated, so safe to rename
  - Indexes updated to match new column names
*/

-- =====================================================
-- Part 1: Update chart_of_accounts_templates
-- =====================================================

-- Drop indexes on old column names
DROP INDEX IF EXISTS idx_coa_templates_account_type;
DROP INDEX IF EXISTS idx_coa_templates_parent;

-- Drop unused columns
ALTER TABLE chart_of_accounts_templates 
  DROP COLUMN IF EXISTS level,
  DROP COLUMN IF EXISTS parent_account_number,
  DROP COLUMN IF EXISTS number_range_start,
  DROP COLUMN IF EXISTS number_range_end;

-- Rename columns to match FINAL COA
ALTER TABLE chart_of_accounts_templates 
  RENAME COLUMN account_type TO class;

ALTER TABLE chart_of_accounts_templates 
  RENAME COLUMN category TO account_type;

ALTER TABLE chart_of_accounts_templates 
  RENAME COLUMN display_name_default TO display_name;

-- Add CHECK constraint on new class column
ALTER TABLE chart_of_accounts_templates 
  ADD CONSTRAINT check_class_values 
  CHECK (class IN ('asset', 'liability', 'equity', 'income', 'expense'));

-- Create new indexes
CREATE INDEX idx_coa_templates_class ON chart_of_accounts_templates(class);
CREATE INDEX idx_coa_templates_account_type ON chart_of_accounts_templates(account_type);

-- =====================================================
-- Part 2: Update user_chart_of_accounts
-- =====================================================

-- Drop indexes on old column names
DROP INDEX IF EXISTS idx_user_coa_account_type;
DROP INDEX IF EXISTS idx_user_coa_parent;

-- Drop unused columns
ALTER TABLE user_chart_of_accounts 
  DROP COLUMN IF EXISTS level,
  DROP COLUMN IF EXISTS parent_account_number;

-- Rename columns to match FINAL COA
ALTER TABLE user_chart_of_accounts 
  RENAME COLUMN account_type TO class;

ALTER TABLE user_chart_of_accounts 
  RENAME COLUMN category TO account_type;

ALTER TABLE user_chart_of_accounts 
  RENAME COLUMN custom_display_name TO display_name;

-- Add CHECK constraint on new class column
ALTER TABLE user_chart_of_accounts 
  ADD CONSTRAINT check_user_coa_class_values 
  CHECK (class IN ('asset', 'liability', 'equity', 'income', 'expense'));

-- Create new indexes
CREATE INDEX idx_user_coa_class ON user_chart_of_accounts(class);
CREATE INDEX idx_user_coa_account_type ON user_chart_of_accounts(account_type);

-- Update UNIQUE constraint to use profile_id instead of user_id
DROP INDEX IF EXISTS idx_user_coa_unique_number;
CREATE UNIQUE INDEX idx_user_coa_unique_number ON user_chart_of_accounts(profile_id, account_number);
