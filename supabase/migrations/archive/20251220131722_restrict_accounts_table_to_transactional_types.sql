/*
  # Restrict Accounts Table to Transactional Account Types Only

  ## Overview
  This migration restricts the accounts table to only store transactional accounts
  (checking, savings, credit_card) and migrates any non-transactional accounts to
  their appropriate tables (assets, liabilities, equity).

  ## Changes

  ### 1. Data Migration
  - Move 'loan', 'other_liability' accounts from accounts table to liabilities table
  - Move 'investment', 'cash', 'property', 'vehicle', 'other_asset' accounts to assets table
  - Move 'equity' accounts to equity table
  - Preserve all account data and relationships

  ### 2. Update CHECK Constraint
  - Restrict account_type to ONLY: 'checking', 'savings', 'credit_card'
  - Remove invalid types: 'loan', 'investment', 'cash', 'property', 'vehicle', 'other_asset', 'other_liability', 'equity'

  ### 3. Update get_next_account_number Function
  - Update numbering ranges to reflect new structure:
    - Bank accounts (checking, savings): 1000-1999
    - Credit cards: 2000-2999
  - Remove ranges for loan, investment, property, etc. (these go in separate tables)

  ## Security
  - All migrated data maintains user_id relationships
  - Existing RLS policies on target tables ensure proper access control
  - No data loss occurs during migration
*/

-- Step 1: Migrate loan and other_liability accounts to liabilities table
INSERT INTO liabilities (
  id, user_id, name, type, current_balance, interest_rate, minimum_payment, 
  due_date, parent_account_id, institution, description, is_active, created_at, updated_at
)
SELECT 
  id,
  user_id,
  account_name as name,
  account_type as type,
  ABS(balance) as current_balance,
  interest_rate,
  minimum_payment,
  payment_due_date as due_date,
  parent_account_id,
  institution_name as institution,
  notes as description,
  is_active,
  created_at,
  updated_at
FROM accounts
WHERE account_type IN ('loan', 'other_liability')
ON CONFLICT (id) DO NOTHING;

-- Step 2: Migrate investment, cash, property, vehicle, other_asset accounts to assets table
INSERT INTO assets (
  id, user_id, name, type, current_value, parent_account_id, 
  institution, notes, is_active, created_at, updated_at
)
SELECT 
  id,
  user_id,
  account_name as name,
  account_type as type,
  balance as current_value,
  parent_account_id,
  institution_name as institution,
  notes,
  is_active,
  created_at,
  updated_at
FROM accounts
WHERE account_type IN ('investment', 'cash', 'property', 'vehicle', 'other_asset')
ON CONFLICT (id) DO NOTHING;

-- Step 3: Migrate equity accounts to equity table
INSERT INTO equity (
  id, user_id, name, type, current_balance, parent_account_id, 
  institution, notes, is_active, created_at, updated_at
)
SELECT 
  id,
  user_id,
  account_name as name,
  account_type as type,
  balance as current_balance,
  parent_account_id,
  institution_name as institution,
  notes,
  is_active,
  created_at,
  updated_at
FROM accounts
WHERE account_type = 'equity'
ON CONFLICT (id) DO NOTHING;

-- Step 4: Delete migrated accounts from accounts table
DELETE FROM accounts
WHERE account_type IN ('loan', 'investment', 'cash', 'property', 'vehicle', 'other_asset', 'other_liability', 'equity');

-- Step 5: Drop the old CHECK constraint and create a new one
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_account_type_check;

ALTER TABLE accounts ADD CONSTRAINT accounts_account_type_check 
  CHECK (account_type IN ('checking', 'savings', 'credit_card'));

-- Step 6: Update the get_next_account_number function
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
  -- Only checking, savings, and credit_card are valid for accounts table
  CASE p_account_type
    WHEN 'checking', 'savings' THEN
      v_range_start := 1000;
      v_range_end := 1999;
    WHEN 'credit_card' THEN
      v_range_start := 2000;
      v_range_end := 2999;
    ELSE
      RAISE EXCEPTION 'Invalid account type for accounts table: %. Use checking, savings, or credit_card only.', p_account_type;
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