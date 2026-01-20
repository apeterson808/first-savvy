/*
  # Update Callers to Use UUID-based Validation

  ## Summary
  Updates create_journal_entry and other functions to use the new UUID-based
  validate_journal_entry_balance function instead of jsonb-based version.
  
  ## Changes
  - Update create_journal_entry to validate AFTER inserting lines
  - Keep upfront jsonb validation for quick failure
  - Add post-insert validation with detailed error messages
  
  ## Impact
  - Better error messages showing entry number and amounts
  - Validation happens against actual database state
*/

-- Update create_journal_entry function
DROP FUNCTION IF EXISTS create_journal_entry(uuid, uuid, date, text, text, text, jsonb);

CREATE OR REPLACE FUNCTION create_journal_entry(
  p_profile_id uuid,
  p_user_id uuid,
  p_entry_date date,
  p_description text,
  p_entry_type text,
  p_source text,
  p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entry_id uuid;
  v_entry_number text;
  v_line jsonb;
  v_line_number integer := 1;
  v_total_debits numeric := 0;
  v_total_credits numeric := 0;
BEGIN
  -- Validate minimum lines
  IF jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'Journal entry must have at least 2 lines.';
  END IF;

  -- Quick upfront validation (before insert)
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    IF (v_line->>'debit_amount')::numeric IS NOT NULL THEN
      v_total_debits := v_total_debits + (v_line->>'debit_amount')::numeric;
    END IF;
    IF (v_line->>'credit_amount')::numeric IS NOT NULL THEN
      v_total_credits := v_total_credits + (v_line->>'credit_amount')::numeric;
    END IF;
  END LOOP;
  
  IF ABS(v_total_debits - v_total_credits) >= 0.01 THEN
    RAISE EXCEPTION 'Journal entry is not balanced. Debits: %, Credits: %, Difference: %',
      v_total_debits, v_total_credits, ABS(v_total_debits - v_total_credits);
  END IF;

  -- Generate entry number
  v_entry_number := generate_journal_entry_number(p_profile_id, p_entry_type);

  -- Insert journal entry
  INSERT INTO journal_entries (
    profile_id, user_id, entry_date, entry_number,
    description, entry_type, source
  ) VALUES (
    p_profile_id, p_user_id, p_entry_date, v_entry_number,
    p_description, p_entry_type, p_source
  ) RETURNING id INTO v_entry_id;

  -- Insert lines
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    INSERT INTO journal_entry_lines (
      journal_entry_id, profile_id, user_id, account_id,
      line_number, debit_amount, credit_amount, description
    ) VALUES (
      v_entry_id, p_profile_id, p_user_id, (v_line->>'account_id')::uuid,
      v_line_number,
      CASE WHEN v_line->>'debit_amount' = 'null' OR v_line->>'debit_amount' IS NULL
           THEN NULL ELSE (v_line->>'debit_amount')::numeric END,
      CASE WHEN v_line->>'credit_amount' = 'null' OR v_line->>'credit_amount' IS NULL
           THEN NULL ELSE (v_line->>'credit_amount')::numeric END,
      v_line->>'description'
    );
    v_line_number := v_line_number + 1;
  END LOOP;

  -- Validate balance using UUID-based function (detailed error messages)
  PERFORM validate_journal_entry_balance(v_entry_id);

  RETURN jsonb_build_object(
    'id', v_entry_id,
    'entry_number', v_entry_number,
    'entry_date', p_entry_date,
    'description', p_description,
    'entry_type', p_entry_type,
    'source', p_source
  );
END;
$$;

COMMENT ON FUNCTION create_journal_entry IS
'Creates a journal entry with multiple lines. Validates balance using UUID-based validation with detailed error messages.';
