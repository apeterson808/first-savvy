/*
  # Add Classification ID to Account Tables

  ## Overview
  This migration adds the account_classification_id foreign key to all account-related
  tables (accounts, assets, liabilities, equity) and creates necessary indexes.

  ## Changes Made

  ### 1. Add classification_id columns
  - Add `account_classification_id` to accounts table
  - Add `account_classification_id` to assets table
  - Add `account_classification_id` to liabilities table
  - Add `account_classification_id` to equity table

  ### 2. Create foreign key constraints
  - All classification_ids reference account_classifications(id)
  - ON DELETE SET NULL to handle classification deletion gracefully

  ### 3. Add indexes
  - Index on each classification_id column for join performance
  - Index on (user_id, classification_id) for filtered queries

  ## Security
  - No RLS changes needed - existing policies continue to work
  - Foreign key constraints ensure data integrity

  ## Notes
  - Columns are nullable initially to allow gradual migration
  - Existing records will have NULL classification_id until migrated
*/

-- ============================================================================
-- ADD CLASSIFICATION_ID COLUMNS
-- ============================================================================

-- Add to accounts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'account_classification_id'
  ) THEN
    ALTER TABLE accounts 
      ADD COLUMN account_classification_id uuid 
      REFERENCES account_classifications(id) ON DELETE SET NULL;
    
    COMMENT ON COLUMN accounts.account_classification_id IS 
      'Reference to user-specific account classification (class, type, category)';
  END IF;
END $$;

-- Add to assets table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'account_classification_id'
  ) THEN
    ALTER TABLE assets 
      ADD COLUMN account_classification_id uuid 
      REFERENCES account_classifications(id) ON DELETE SET NULL;
    
    COMMENT ON COLUMN assets.account_classification_id IS 
      'Reference to user-specific account classification (class, type, category)';
  END IF;
END $$;

-- Add to liabilities table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'liabilities' AND column_name = 'account_classification_id'
  ) THEN
    ALTER TABLE liabilities 
      ADD COLUMN account_classification_id uuid 
      REFERENCES account_classifications(id) ON DELETE SET NULL;
    
    COMMENT ON COLUMN liabilities.account_classification_id IS 
      'Reference to user-specific account classification (class, type, category)';
  END IF;
END $$;

-- Add to equity table  
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equity' AND column_name = 'account_classification_id'
  ) THEN
    ALTER TABLE equity 
      ADD COLUMN account_classification_id uuid 
      REFERENCES account_classifications(id) ON DELETE SET NULL;
    
    COMMENT ON COLUMN equity.account_classification_id IS 
      'Reference to user-specific account classification (class, type, category)';
  END IF;
END $$;

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Indexes on accounts table
CREATE INDEX IF NOT EXISTS idx_accounts_classification_id 
  ON accounts(account_classification_id) 
  WHERE account_classification_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_accounts_user_classification 
  ON accounts(user_id, account_classification_id) 
  WHERE account_classification_id IS NOT NULL;

-- Indexes on assets table
CREATE INDEX IF NOT EXISTS idx_assets_classification_id 
  ON assets(account_classification_id) 
  WHERE account_classification_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_assets_user_classification 
  ON assets(user_id, account_classification_id) 
  WHERE account_classification_id IS NOT NULL;

-- Indexes on liabilities table
CREATE INDEX IF NOT EXISTS idx_liabilities_classification_id 
  ON liabilities(account_classification_id) 
  WHERE account_classification_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_liabilities_user_classification 
  ON liabilities(user_id, account_classification_id) 
  WHERE account_classification_id IS NOT NULL;

-- Indexes on equity table
CREATE INDEX IF NOT EXISTS idx_equity_classification_id 
  ON equity(account_classification_id) 
  WHERE account_classification_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_equity_user_classification 
  ON equity(user_id, account_classification_id) 
  WHERE account_classification_id IS NOT NULL;
