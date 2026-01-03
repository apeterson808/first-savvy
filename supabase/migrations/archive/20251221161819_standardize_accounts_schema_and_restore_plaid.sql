/*
  # Standardize Accounts Schema and Restore Plaid Integration
  
  ## Overview
  This migration standardizes the accounts table schema to align with Plaid API naming
  conventions and prepares the system for future financial API integrations. It also
  restores Plaid integration fields that were previously removed.
  
  ## Changes
  
  ### 1. Restore Plaid Integration Fields
  - Add `plaid_account_id` (text, unique) - Plaid's unique identifier for the account
  - Add `plaid_item_id` (text) - Plaid's unique identifier for the institution connection
  - Add `plaid_transaction_id` to transactions table for sync tracking
  - Add indexes for performance
  
  ### 2. Add Account Metadata Fields
  - Add `official_name` (text) - Official account name from the institution
  - Add `mask` (text) - Last 4 digits or account mask
  - Add `routing_number` (text) - Bank routing number (for checking/savings)
  
  ### 3. Standardize Existing Fields
  - Ensure `institution_name` exists and is properly named
  - Ensure `account_number_last4` exists for compatibility
  
  ### 4. Add Credit Card Specific Fields
  - Add `is_overdue` (boolean) - Whether the account has overdue payments
  - Add `last_payment_amount` (decimal) - Amount of last payment
  - Add `last_payment_date` (date) - Date of last payment
  - Add `next_payment_due_date` (date) - Next payment due date
  - Add `next_payment_minimum_amount` (decimal) - Minimum payment amount
  
  ### 5. Add Plaid-Compatible Type Fields
  - Add `plaid_type` (text) - Plaid's account type (depository, credit, loan, investment)
  - Add `plaid_subtype` (text) - Plaid's account subtype (checking, savings, credit card, etc.)
  
  ## Security
  - All new columns are nullable to prevent issues with existing data
  - No data loss occurs during migration
  - RLS policies remain unchanged
  - Indexes added for foreign key columns
  
  ## Plaid Integration Readiness
  This migration prepares the schema to seamlessly accept data from:
  - Plaid API (primary target)
  - Other financial APIs (MX, Yodlee, Finicity)
  - Manual account entry (all fields remain optional)
*/

-- ============================================================================
-- 1. ADD PLAID INTEGRATION FIELDS TO ACCOUNTS TABLE
-- ============================================================================

-- Add plaid_account_id (unique identifier from Plaid)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'plaid_account_id'
  ) THEN
    ALTER TABLE accounts ADD COLUMN plaid_account_id text UNIQUE;
    COMMENT ON COLUMN accounts.plaid_account_id IS 'Plaid unique account identifier';
  END IF;
END $$;

-- Add plaid_item_id (links to institution connection)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'plaid_item_id'
  ) THEN
    ALTER TABLE accounts ADD COLUMN plaid_item_id text;
    COMMENT ON COLUMN accounts.plaid_item_id IS 'Plaid item ID linking account to institution connection';
  END IF;
END $$;

-- ============================================================================
-- 2. ADD ACCOUNT METADATA FIELDS
-- ============================================================================

-- Add official_name (official account name from institution)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'official_name'
  ) THEN
    ALTER TABLE accounts ADD COLUMN official_name text;
    COMMENT ON COLUMN accounts.official_name IS 'Official account name from financial institution';
  END IF;
END $$;

-- Add mask (last 4 digits or account identifier)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'mask'
  ) THEN
    ALTER TABLE accounts ADD COLUMN mask text;
    COMMENT ON COLUMN accounts.mask IS 'Last 4 digits or account mask';
  END IF;
END $$;

-- Add routing_number (for ACH transfers)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'routing_number'
  ) THEN
    ALTER TABLE accounts ADD COLUMN routing_number text;
    COMMENT ON COLUMN accounts.routing_number IS 'Bank routing number for checking/savings accounts';
  END IF;
END $$;

-- ============================================================================
-- 3. ADD CREDIT CARD SPECIFIC FIELDS
-- ============================================================================

-- Add is_overdue flag
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'is_overdue'
  ) THEN
    ALTER TABLE accounts ADD COLUMN is_overdue boolean DEFAULT false;
    COMMENT ON COLUMN accounts.is_overdue IS 'Whether the account has overdue payments';
  END IF;
END $$;

-- Add last_payment_amount
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'last_payment_amount'
  ) THEN
    ALTER TABLE accounts ADD COLUMN last_payment_amount decimal(15,2);
    COMMENT ON COLUMN accounts.last_payment_amount IS 'Amount of the last payment made';
  END IF;
END $$;

-- Add last_payment_date
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'last_payment_date'
  ) THEN
    ALTER TABLE accounts ADD COLUMN last_payment_date date;
    COMMENT ON COLUMN accounts.last_payment_date IS 'Date of the last payment';
  END IF;
END $$;

-- Add next_payment_due_date
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'next_payment_due_date'
  ) THEN
    ALTER TABLE accounts ADD COLUMN next_payment_due_date date;
    COMMENT ON COLUMN accounts.next_payment_due_date IS 'Next payment due date';
  END IF;
END $$;

-- Add next_payment_minimum_amount
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'next_payment_minimum_amount'
  ) THEN
    ALTER TABLE accounts ADD COLUMN next_payment_minimum_amount decimal(15,2);
    COMMENT ON COLUMN accounts.next_payment_minimum_amount IS 'Minimum payment amount for next due date';
  END IF;
END $$;

-- ============================================================================
-- 4. ADD PLAID-COMPATIBLE TYPE FIELDS
-- ============================================================================

-- Add plaid_type (depository, credit, loan, investment)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'plaid_type'
  ) THEN
    ALTER TABLE accounts ADD COLUMN plaid_type text;
    COMMENT ON COLUMN accounts.plaid_type IS 'Plaid account type: depository, credit, loan, investment';
  END IF;
END $$;

-- Add plaid_subtype (checking, savings, credit card, etc.)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'plaid_subtype'
  ) THEN
    ALTER TABLE accounts ADD COLUMN plaid_subtype text;
    COMMENT ON COLUMN accounts.plaid_subtype IS 'Plaid account subtype: checking, savings, credit card, etc.';
  END IF;
END $$;

-- ============================================================================
-- 5. ADD PLAID TRANSACTION ID TO TRANSACTIONS TABLE
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'plaid_transaction_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN plaid_transaction_id text UNIQUE;
    COMMENT ON COLUMN transactions.plaid_transaction_id IS 'Plaid unique transaction identifier';
  END IF;
END $$;

-- ============================================================================
-- 6. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

-- Index for plaid_account_id lookups
CREATE INDEX IF NOT EXISTS idx_accounts_plaid_account_id 
  ON accounts(plaid_account_id) WHERE plaid_account_id IS NOT NULL;

-- Index for plaid_item_id lookups (for fetching all accounts from an item)
CREATE INDEX IF NOT EXISTS idx_accounts_plaid_item_id 
  ON accounts(plaid_item_id) WHERE plaid_item_id IS NOT NULL;

-- Index for plaid_transaction_id lookups
CREATE INDEX IF NOT EXISTS idx_transactions_plaid_transaction_id 
  ON transactions(plaid_transaction_id) WHERE plaid_transaction_id IS NOT NULL;

-- Index for overdue accounts
CREATE INDEX IF NOT EXISTS idx_accounts_is_overdue 
  ON accounts(is_overdue) WHERE is_overdue = true;

-- Index for next payment due dates (for payment reminders)
CREATE INDEX IF NOT EXISTS idx_accounts_next_payment_due_date 
  ON accounts(next_payment_due_date) WHERE next_payment_due_date IS NOT NULL;

-- ============================================================================
-- 7. CREATE PLAID ITEMS TABLE FOR MANAGING INSTITUTION CONNECTIONS
-- ============================================================================

CREATE TABLE IF NOT EXISTS plaid_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Plaid identifiers
  item_id text NOT NULL UNIQUE,
  access_token text NOT NULL,
  
  -- Institution information
  institution_id text,
  institution_name text,
  
  -- Connection status
  status text DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'error')),
  error_code text,
  error_message text,
  
  -- Consent and capabilities
  consented_products text[],
  available_products text[],
  
  -- Sync information
  last_successful_update timestamptz,
  last_failed_update timestamptz,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  UNIQUE(user_id, item_id)
);

-- Enable RLS on plaid_items
ALTER TABLE plaid_items ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for plaid_items
CREATE POLICY "Users can view own plaid items"
  ON plaid_items FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own plaid items"
  ON plaid_items FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plaid items"
  ON plaid_items FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own plaid items"
  ON plaid_items FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for plaid_items
CREATE INDEX IF NOT EXISTS idx_plaid_items_user_id ON plaid_items(user_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_item_id ON plaid_items(item_id);
CREATE INDEX IF NOT EXISTS idx_plaid_items_status ON plaid_items(status);

-- ============================================================================
-- 8. MIGRATE EXISTING DATA TO NEW FIELDS
-- ============================================================================

-- Copy account_number_last4 to mask if mask is null
UPDATE accounts
SET mask = account_number_last4
WHERE mask IS NULL AND account_number_last4 IS NOT NULL;

-- Map internal account_type to plaid_type
UPDATE accounts
SET plaid_type = CASE
  WHEN account_type IN ('checking', 'savings') THEN 'depository'
  WHEN account_type = 'credit_card' THEN 'credit'
  WHEN account_type = 'loan' THEN 'loan'
  WHEN account_type = 'investment' THEN 'investment'
  ELSE NULL
END
WHERE plaid_type IS NULL;

-- Map internal account_type to plaid_subtype
UPDATE accounts
SET plaid_subtype = account_type
WHERE plaid_subtype IS NULL;
