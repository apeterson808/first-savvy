/*
  # Remove Account Classification System and Add Simple Type/Detail Fields

  ## Overview
  This migration completely removes the complex account classification system and replaces
  it with a simple two-field approach: account_type and account_detail. This simplifies
  the user experience and removes unnecessary complexity.

  ## Changes Made

  ### 1. Data Cleanup
  - DELETE all user account classifications data
  - KEEP account records but remove classification references

  ### 2. Drop Classification Tables
  - DROP account_classifications table
  - DROP account_classification_templates table
  - DROP related triggers and functions

  ### 3. Remove Classification Columns
  - Remove account_classification_id from accounts table
  - Remove account_classification_id from assets table
  - Remove account_classification_id from liabilities table
  - Remove account_classification_id from equity table
  - Remove account_classification_id from transactions table
  - Remove account_classification_id from budgets table

  ### 4. Add New Simple Fields
  - Add account_type to accounts, assets, liabilities, equity tables
  - Add account_detail to accounts, assets, liabilities, equity tables
  - Both fields are text type for simplicity

  ### 5. Security
  - All RLS policies remain unchanged
  - No impact on user authentication or profiles
  - Account data preserved (only classification references removed)

  ## Important Notes
  - This is a breaking change for the classification system
  - Existing accounts will have NULL type/detail until updated
  - Frontend will be updated to use simple dropdowns instead
*/

-- ============================================================================
-- STEP 1: DROP TRIGGERS AND FUNCTIONS RELATED TO CLASSIFICATIONS
-- ============================================================================

DO $$
BEGIN
  -- Drop trigger for auto-provisioning user classifications
  DROP TRIGGER IF EXISTS trigger_provision_user_classifications ON user_profiles;
  RAISE NOTICE 'Dropped auto-provision trigger';

  -- Drop the provisioning function
  DROP FUNCTION IF EXISTS provision_user_classifications();
  RAISE NOTICE 'Dropped provisioning function';

  -- Drop category auto-provisioning if exists
  DROP TRIGGER IF EXISTS trigger_provision_user_categories ON user_profiles;
  DROP FUNCTION IF EXISTS provision_user_categories();
  RAISE NOTICE 'Dropped category provisioning';
END $$;

-- ============================================================================
-- STEP 2: REMOVE CLASSIFICATION COLUMNS FROM ALL TABLES
-- ============================================================================

-- Remove from accounts table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'account_classification_id'
  ) THEN
    DROP INDEX IF EXISTS idx_accounts_classification_id;
    DROP INDEX IF EXISTS idx_accounts_user_classification;
    ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_account_classification_id_fkey;
    ALTER TABLE accounts DROP COLUMN account_classification_id;
    RAISE NOTICE 'Removed account_classification_id from accounts';
  END IF;
END $$;

-- Remove from assets table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'account_classification_id'
  ) THEN
    DROP INDEX IF EXISTS idx_assets_classification_id;
    DROP INDEX IF EXISTS idx_assets_user_classification;
    ALTER TABLE assets DROP CONSTRAINT IF EXISTS assets_account_classification_id_fkey;
    ALTER TABLE assets DROP COLUMN account_classification_id;
    RAISE NOTICE 'Removed account_classification_id from assets';
  END IF;
END $$;

-- Remove from liabilities table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'liabilities' AND column_name = 'account_classification_id'
  ) THEN
    DROP INDEX IF EXISTS idx_liabilities_classification_id;
    DROP INDEX IF EXISTS idx_liabilities_user_classification;
    ALTER TABLE liabilities DROP CONSTRAINT IF EXISTS liabilities_account_classification_id_fkey;
    ALTER TABLE liabilities DROP COLUMN account_classification_id;
    RAISE NOTICE 'Removed account_classification_id from liabilities';
  END IF;
END $$;

-- Remove from equity table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equity' AND column_name = 'account_classification_id'
  ) THEN
    DROP INDEX IF EXISTS idx_equity_classification_id;
    DROP INDEX IF EXISTS idx_equity_user_classification;
    ALTER TABLE equity DROP CONSTRAINT IF EXISTS equity_account_classification_id_fkey;
    ALTER TABLE equity DROP COLUMN account_classification_id;
    RAISE NOTICE 'Removed account_classification_id from equity';
  END IF;
END $$;

-- Remove from transactions table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'account_classification_id'
  ) THEN
    DROP INDEX IF EXISTS idx_transactions_account_classification_id;
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_account_classification_id_fkey;
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_classification_type_check;
    ALTER TABLE transactions DROP COLUMN account_classification_id;
    RAISE NOTICE 'Removed account_classification_id from transactions';
  END IF;
END $$;

-- Remove from budgets table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'account_classification_id'
  ) THEN
    DROP INDEX IF EXISTS idx_budgets_account_classification_id;
    ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_account_classification_id_fkey;
    ALTER TABLE budgets DROP COLUMN account_classification_id;
    RAISE NOTICE 'Removed account_classification_id from budgets';
  END IF;
END $$;

-- ============================================================================
-- STEP 3: DROP CLASSIFICATION TABLES
-- ============================================================================

DO $$
BEGIN
  -- Drop user classifications table
  DROP TABLE IF EXISTS account_classifications CASCADE;
  RAISE NOTICE 'Dropped account_classifications table';

  -- Drop templates table
  DROP TABLE IF EXISTS account_classification_templates CASCADE;
  RAISE NOTICE 'Dropped account_classification_templates table';
END $$;

-- ============================================================================
-- STEP 4: ADD NEW SIMPLE TYPE AND DETAIL FIELDS
-- ============================================================================

-- Add to accounts table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'account_type'
  ) THEN
    ALTER TABLE accounts ADD COLUMN account_type text;
    COMMENT ON COLUMN accounts.account_type IS 'Simple account type (e.g., "Bank Account", "Credit Card", "Investment")';
    RAISE NOTICE 'Added account_type to accounts';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'account_detail'
  ) THEN
    ALTER TABLE accounts ADD COLUMN account_detail text;
    COMMENT ON COLUMN accounts.account_detail IS 'Account detail/subtype (e.g., "Checking", "Savings", "Personal")';
    RAISE NOTICE 'Added account_detail to accounts';
  END IF;
END $$;

-- Add to assets table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'account_type'
  ) THEN
    ALTER TABLE assets ADD COLUMN account_type text;
    COMMENT ON COLUMN assets.account_type IS 'Simple account type (e.g., "Investment", "Property", "Vehicle")';
    RAISE NOTICE 'Added account_type to assets';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'account_detail'
  ) THEN
    ALTER TABLE assets ADD COLUMN account_detail text;
    COMMENT ON COLUMN assets.account_detail IS 'Asset detail/subtype (e.g., "401k", "IRA", "Real Estate")';
    RAISE NOTICE 'Added account_detail to assets';
  END IF;
END $$;

-- Add to liabilities table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'liabilities' AND column_name = 'account_type'
  ) THEN
    ALTER TABLE liabilities ADD COLUMN account_type text;
    COMMENT ON COLUMN liabilities.account_type IS 'Simple account type (e.g., "Loan", "Mortgage", "Credit Card")';
    RAISE NOTICE 'Added account_type to liabilities';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'liabilities' AND column_name = 'account_detail'
  ) THEN
    ALTER TABLE liabilities ADD COLUMN account_detail text;
    COMMENT ON COLUMN liabilities.account_detail IS 'Liability detail/subtype (e.g., "Personal Loan", "Auto Loan", "Student Loan")';
    RAISE NOTICE 'Added account_detail to liabilities';
  END IF;
END $$;

-- Add to equity table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equity' AND column_name = 'account_type'
  ) THEN
    ALTER TABLE equity ADD COLUMN account_type text;
    COMMENT ON COLUMN equity.account_type IS 'Simple account type (e.g., "Owner Equity", "Retained Earnings")';
    RAISE NOTICE 'Added account_type to equity';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equity' AND column_name = 'account_detail'
  ) THEN
    ALTER TABLE equity ADD COLUMN account_detail text;
    COMMENT ON COLUMN equity.account_detail IS 'Equity detail/subtype';
    RAISE NOTICE 'Added account_detail to equity';
  END IF;
END $$;

-- ============================================================================
-- STEP 5: ADD INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_accounts_account_type ON accounts(account_type) WHERE account_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_accounts_account_detail ON accounts(account_detail) WHERE account_detail IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_assets_account_type ON assets(account_type) WHERE account_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_liabilities_account_type ON liabilities(account_type) WHERE account_type IS NOT NULL;

-- Final summary
DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Classification System Removal Complete!';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Dropped: account_classifications table';
  RAISE NOTICE 'Dropped: account_classification_templates table';
  RAISE NOTICE 'Added: account_type and account_detail columns';
  RAISE NOTICE 'All accounts now use simple type/detail fields';
  RAISE NOTICE '================================================';
END $$;
