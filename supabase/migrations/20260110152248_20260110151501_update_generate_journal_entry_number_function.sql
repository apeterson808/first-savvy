/*
  # Update Journal Entry Number Generation Function

  ## Changes
  1. Accept entry_type parameter to generate type-specific numbers
  2. Use journal_entry_counters table for atomic increment
  3. Apply prefix based on entry_type (ADJ-0001, TRF-0001, etc.)
  4. Handle dynamic padding (grows beyond 9999 automatically)

  ## Entry Type Prefixes
  - opening_balance: OB
  - adjustment: ADJ
  - transfer: TRF
  - reclassification: RCL
  - closing: CLS
  - depreciation: DEP
  - accrual: ACR
  - reversal: REV

  ## Number Format
  - 0001 to 9999: 4 digits with padding (ADJ-0001)
  - 10000+: Natural growth, no padding (ADJ-10000)
*/

CREATE OR REPLACE FUNCTION generate_journal_entry_number(
  p_profile_id uuid,
  p_entry_type text
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_next_number integer;
  v_prefix text;
  v_formatted_number text;
BEGIN
  -- Map entry type to prefix
  v_prefix := CASE p_entry_type
    WHEN 'opening_balance' THEN 'OB'
    WHEN 'adjustment' THEN 'ADJ'
    WHEN 'transfer' THEN 'TRF'
    WHEN 'reclassification' THEN 'RCL'
    WHEN 'closing' THEN 'CLS'
    WHEN 'depreciation' THEN 'DEP'
    WHEN 'accrual' THEN 'ACR'
    WHEN 'reversal' THEN 'REV'
    ELSE 'ADJ' -- Default to adjustment
  END;

  -- Get and increment the counter atomically
  -- Insert if not exists, or update if exists
  INSERT INTO journal_entry_counters (profile_id, entry_type, next_number)
  VALUES (p_profile_id, p_entry_type, 2)
  ON CONFLICT (profile_id, entry_type)
  DO UPDATE SET
    next_number = journal_entry_counters.next_number + 1,
    last_updated = now()
  RETURNING next_number - 1 INTO v_next_number;

  -- If this was an insert (first time), next_number will be 2, so we return 1
  -- If this was an update, next_number was incremented, so we return the old value
  IF v_next_number IS NULL THEN
    v_next_number := 1;
  END IF;

  -- Format with padding only if less than 10000
  IF v_next_number < 10000 THEN
    v_formatted_number := v_prefix || '-' || LPAD(v_next_number::text, 4, '0');
  ELSE
    v_formatted_number := v_prefix || '-' || v_next_number::text;
  END IF;

  RETURN v_formatted_number;
END;
$$;
