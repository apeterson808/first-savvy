/*
  # Add Equity Account Type Support

  ## Overview
  Adds equity as a new account type to support complete Chart of Accounts structure
  following QuickBooks standards. Equity accounts represent ownership in the business
  or net worth for personal finance.

  ## Changes

  ### 1. Account Type Updates
  - Add 'equity' to account_type CHECK constraint
  - Update get_next_account_number function to handle equity range (3000-3999)

  ### 2. Equity Account Number Ranges
  - 3000-3099: Owner's/Partner's Capital accounts
  - 3100-3199: Stock accounts (Common/Preferred)
  - 3200-3299: Paid-in Capital accounts
  - 3300-3399: Retained Earnings
  - 3400-3499: Draws and Distributions
  - 3900-3999: Other Equity accounts

  ## Security
  - No RLS changes needed (existing policies apply)
  - Function remains SECURITY DEFINER with search_path set
*/

-- Step 1: Update account_type constraint to include equity
DO $$
BEGIN
  -- Drop the existing constraint
  ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_account_type_check;
  
  -- Add new constraint with equity included
  ALTER TABLE accounts ADD CONSTRAINT accounts_account_type_check 
    CHECK (account_type IN (
      'checking', 'savings', 'credit_card', 'loan', 'investment', 
      'cash', 'property', 'vehicle', 'other_asset', 'other_liability', 'equity'
    ));
END $$;

-- Step 2: Update get_next_account_number function to handle equity accounts
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
    WHEN 'equity' THEN
      v_range_start := 3000;
      v_range_end := 3999;
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
