/*
  # Fix Account Number Generation Function

  ## Overview
  The get_next_available_account_number function was referencing non-existent columns
  (number_range_start, number_range_end, level). This migration fixes the function to use
  hardcoded ranges based on the account class.

  ## Changes
  1. Updates get_next_available_account_number to use class-based ranges
     - Income: 4900-4999
     - Expense: 5900-5999
  2. Updates validate_account_number_range to use same logic
  3. Uses profile_id instead of user_id to match schema

  ## Account Number Ranges
  - Income (user-created): 4900-4999
  - Expense (user-created): 5900-5999
*/

-- Fix get_next_available_account_number function
CREATE OR REPLACE FUNCTION get_next_available_account_number(
  p_user_id uuid,
  p_account_type text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_range_start integer;
  v_range_end integer;
  v_next_number integer;
BEGIN
  -- Define ranges based on account type
  IF p_account_type = 'income' THEN
    v_range_start := 4900;
    v_range_end := 4999;
  ELSIF p_account_type = 'expense' THEN
    v_range_start := 5900;
    v_range_end := 5999;
  ELSE
    RAISE EXCEPTION 'Invalid account type: %. Must be income or expense', p_account_type;
  END IF;

  -- Find the next available number in the range
  SELECT COALESCE(MAX(account_number), v_range_start - 1) + 1
  INTO v_next_number
  FROM user_chart_of_accounts
  WHERE profile_id = p_user_id
    AND class = p_account_type
    AND account_number >= v_range_start
    AND account_number <= v_range_end;

  -- Check if we've exceeded the range
  IF v_next_number > v_range_end THEN
    RAISE EXCEPTION 'No available account numbers in range % to % for account type %',
      v_range_start, v_range_end, p_account_type;
  END IF;

  RETURN v_next_number;
END;
$$;

-- Fix validate_account_number_range function
CREATE OR REPLACE FUNCTION validate_account_number_range(
  p_account_number integer,
  p_account_type text,
  p_is_user_created boolean DEFAULT true
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_range_start integer;
  v_range_end integer;
BEGIN
  -- If not user-created, any number is valid (templates control this)
  IF NOT p_is_user_created THEN
    RETURN true;
  END IF;

  -- Define ranges based on account type
  IF p_account_type = 'income' THEN
    v_range_start := 4900;
    v_range_end := 4999;
  ELSIF p_account_type = 'expense' THEN
    v_range_start := 5900;
    v_range_end := 5999;
  ELSE
    RETURN false;
  END IF;

  -- Check if number is within range
  RETURN p_account_number >= v_range_start AND p_account_number <= v_range_end;
END;
$$;

GRANT EXECUTE ON FUNCTION get_next_available_account_number TO authenticated;
GRANT EXECUTE ON FUNCTION validate_account_number_range TO authenticated;
