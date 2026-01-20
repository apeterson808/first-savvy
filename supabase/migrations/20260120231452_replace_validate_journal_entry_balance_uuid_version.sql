/*
  # Replace validate_journal_entry_balance with UUID-based Version (SAFETY NIT 1)

  ## Summary
  Replaces jsonb-based validation with UUID-based version that:
  - Takes journal_entry_id UUID parameter instead of jsonb lines array
  - Raises detailed error messages showing entry number, debits, credits, and difference
  - Provides better debugging and audit trail
  
  ## Changes
  - DROP old jsonb-based function
  - CREATE new UUID-based function with detailed error messages
  - Uses SECURITY DEFINER with search_path set for safety
  
  ## Breaking Change
  - All callers must be updated to use PERFORM validate_journal_entry_balance(v_journal_entry_id)
  - Next migration will update existing callers
*/

-- Drop the old jsonb-based version
DROP FUNCTION IF EXISTS validate_journal_entry_balance(jsonb);

-- Create new UUID-based version with detailed error messages
CREATE OR REPLACE FUNCTION validate_journal_entry_balance(p_journal_entry_id UUID)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_total_debits numeric := 0;
  v_total_credits numeric := 0;
  v_difference numeric;
  v_entry_number TEXT;
BEGIN
  -- Get the entry number for error messages
  SELECT entry_number INTO v_entry_number
  FROM journal_entries
  WHERE id = p_journal_entry_id;
  
  IF v_entry_number IS NULL THEN
    RAISE EXCEPTION 'Journal entry % not found', p_journal_entry_id;
  END IF;
  
  -- Sum up all debits and credits from journal_entry_lines
  SELECT 
    COALESCE(SUM(debit_amount), 0),
    COALESCE(SUM(credit_amount), 0)
  INTO v_total_debits, v_total_credits
  FROM journal_entry_lines
  WHERE journal_entry_id = p_journal_entry_id;

  -- Calculate difference
  v_difference := ABS(v_total_debits - v_total_credits);

  -- If not balanced, raise detailed error
  IF v_difference >= 0.01 THEN
    RAISE EXCEPTION 'Journal entry % is not balanced. Debits: %, Credits: %, Difference: %',
      v_entry_number,
      v_total_debits,
      v_total_credits,
      v_difference;
  END IF;

  RETURN true;
END;
$$;
