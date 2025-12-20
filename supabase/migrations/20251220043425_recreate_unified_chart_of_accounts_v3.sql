/*
  # Recreate Unified Chart of Accounts System

  ## Overview
  This migration drops and recreates the accounts table with the complete QuickBooks-style
  Chart of Accounts structure, including all necessary fields for managing checking, savings,
  credit cards, loans, investments, and other account types in a unified system.

  ## Changes

  ### 1. Drop and Recreate accounts table
  - Removes minimal accounts table
  - Creates comprehensive accounts table with all fields
  - Includes QuickBooks-style numbering (1000-9999)
  - Supports hierarchical sub-accounts
  - Credit card specific fields
  - External integration fields (Plaid)

  ### 2. Data Migration
  - Migrate all records from bank_accounts (1000-1999 range)
  - Migrate all records from credit_cards (2000-2999 range)
  - Preserve all data and relationships

  ### 3. Security
  - Enable RLS with proper policies
  - Ensure data isolation per user
*/

-- Step 1: Drop existing minimal accounts table
DROP TABLE IF EXISTS accounts CASCADE;

-- Step 2: Create comprehensive accounts table
CREATE TABLE accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  -- Account identification
  account_number text NOT NULL,
  account_name text NOT NULL,
  account_type text NOT NULL CHECK (account_type IN (
    'checking', 'savings', 'credit_card', 'loan', 'investment', 
    'cash', 'property', 'vehicle', 'other_asset', 'other_liability'
  )),
  account_subtype text,
  parent_account_id uuid REFERENCES accounts(id) ON DELETE SET NULL,
  
  -- Institution details
  institution_name text,
  account_number_last4 text,
  
  -- Balance information
  balance decimal(15,2) DEFAULT 0,
  available_balance decimal(15,2),
  
  -- Credit-specific fields
  credit_limit decimal(15,2),
  interest_rate decimal(5,2),
  minimum_payment decimal(15,2),
  payment_due_date date,
  statement_balance decimal(15,2),
  
  -- General settings
  currency text DEFAULT 'USD',
  is_active boolean DEFAULT true,
  is_closed boolean DEFAULT false,
  include_in_net_worth boolean DEFAULT true,
  
  -- UI customization
  icon text,
  color text,
  notes text,
  
  -- External integrations (plaid_item_id is text to match existing tables)
  plaid_account_id text UNIQUE,
  plaid_item_id text,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Constraints
  UNIQUE(user_id, account_number)
);

-- Step 3: Create indexes for performance
CREATE INDEX idx_accounts_user_id ON accounts(user_id);
CREATE INDEX idx_accounts_account_type ON accounts(account_type);
CREATE INDEX idx_accounts_parent_account_id ON accounts(parent_account_id);
CREATE INDEX idx_accounts_plaid_account_id ON accounts(plaid_account_id);
CREATE INDEX idx_accounts_is_active ON accounts(is_active) WHERE is_active = true;

-- Step 4: Enable RLS
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies
CREATE POLICY "Users can view own accounts"
  ON accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own accounts"
  ON accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts"
  ON accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts"
  ON accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Step 6: Migrate data from bank_accounts table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'bank_accounts') THEN
    INSERT INTO accounts (
      id, user_id, account_number, account_name, account_type, account_subtype,
      institution_name, account_number_last4, balance, available_balance,
      currency, is_active, icon, color, notes, plaid_account_id, plaid_item_id,
      include_in_net_worth, created_at, updated_at, parent_account_id
    )
    SELECT 
      id,
      user_id,
      '1' || LPAD((ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at))::text, 3, '0'),
      account_name,
      CASE 
        WHEN account_type = 'checking' THEN 'checking'
        WHEN account_type = 'savings' THEN 'savings'
        ELSE 'other_asset'
      END,
      account_type as account_subtype,
      institution as institution_name,
      account_number as account_number_last4,
      current_balance as balance,
      current_balance as available_balance,
      currency,
      is_active,
      'Building2' as icon,
      '#3b82f6' as color,
      NULL as notes,
      plaid_account_id,
      plaid_item_id,
      true as include_in_net_worth,
      created_at,
      updated_at,
      parent_account_id
    FROM bank_accounts;
  END IF;
END $$;

-- Step 7: Migrate data from credit_cards table
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'credit_cards') THEN
    INSERT INTO accounts (
      id, user_id, account_number, account_name, account_type, account_subtype,
      institution_name, account_number_last4, balance, available_balance,
      credit_limit, interest_rate, minimum_payment, payment_due_date, statement_balance,
      currency, is_active, icon, color, notes, plaid_account_id, plaid_item_id,
      include_in_net_worth, created_at, updated_at, parent_account_id
    )
    SELECT 
      id,
      user_id,
      '2' || LPAD((ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY created_at))::text, 3, '0'),
      COALESCE(nickname, name) as account_name,
      'credit_card',
      'credit_card' as account_subtype,
      institution as institution_name,
      last_four as account_number_last4,
      -1 * ABS(COALESCE(current_balance, 0)) as balance,
      CASE 
        WHEN credit_limit IS NOT NULL AND current_balance IS NOT NULL 
        THEN credit_limit - ABS(current_balance)
        ELSE NULL
      END as available_balance,
      credit_limit,
      apr as interest_rate,
      minimum_payment,
      due_date as payment_due_date,
      statement_balance,
      COALESCE(currency, 'USD') as currency,
      is_active,
      'CreditCard' as icon,
      COALESCE(color, '#10b981') as color,
      notes,
      plaid_account_id,
      plaid_item_id,
      true as include_in_net_worth,
      created_at,
      updated_at,
      parent_account_id
    FROM credit_cards;
  END IF;
END $$;

-- Step 8: Add account_id column to transactions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'account_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN account_id uuid REFERENCES accounts(id) ON DELETE CASCADE;
    CREATE INDEX idx_transactions_account_id ON transactions(account_id);
  END IF;
END $$;

-- Step 9: Migrate transaction references from bank_account_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'bank_account_id') THEN
    UPDATE transactions t
    SET account_id = t.bank_account_id
    WHERE t.bank_account_id IS NOT NULL
      AND t.account_id IS NULL
      AND EXISTS (SELECT 1 FROM accounts WHERE id = t.bank_account_id);
  END IF;
END $$;

-- Step 10: Migrate transaction references from credit_card_id
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'credit_card_id') THEN
    UPDATE transactions t
    SET account_id = t.credit_card_id
    WHERE t.credit_card_id IS NOT NULL
      AND t.account_id IS NULL
      AND EXISTS (SELECT 1 FROM accounts WHERE id = t.credit_card_id);
  END IF;
END $$;

-- Step 11: Create updated_at trigger
CREATE OR REPLACE FUNCTION update_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_accounts_updated_at
  BEFORE UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_accounts_updated_at();

-- Step 12: Create helper function to get next account number
CREATE OR REPLACE FUNCTION get_next_account_number(
  p_user_id uuid,
  p_account_type text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_range_start int;
  v_range_end int;
  v_next_number int;
BEGIN
  -- Determine range based on account type
  CASE p_account_type
    WHEN 'checking', 'savings', 'investment', 'cash', 'property', 'vehicle', 'other_asset' THEN
      v_range_start := 1000;
      v_range_end := 1999;
    WHEN 'credit_card', 'loan', 'other_liability' THEN
      v_range_start := 2000;
      v_range_end := 2999;
    ELSE
      v_range_start := 9000;
      v_range_end := 9999;
  END CASE;
  
  -- Find the next available number in the range
  SELECT COALESCE(MAX(account_number::int), v_range_start - 1) + 1
  INTO v_next_number
  FROM accounts
  WHERE user_id = p_user_id
    AND account_number ~ '^\d+$'
    AND account_number::int >= v_range_start
    AND account_number::int <= v_range_end;
  
  -- Ensure we don't exceed the range
  IF v_next_number > v_range_end THEN
    RAISE EXCEPTION 'No available account numbers in range % to %', v_range_start, v_range_end;
  END IF;
  
  RETURN v_next_number::text;
END;
$$;
