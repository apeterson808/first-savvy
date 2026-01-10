/*
  # Update create_journal_entry Function for Type-Based Numbering

  ## Changes
  - Update create_journal_entry to use generate_journal_entry_number with entry_type
  - Replace get_next_journal_entry_number with generate_journal_entry_number
  - Ensure entry numbers follow new format (ADJ-0001, OB-0001, etc.)

  ## Backward Compatibility
  - Function signature remains the same
  - Only internal number generation logic changes
*/

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
BEGIN
  IF NOT validate_journal_entry_balance(p_lines) THEN
    RAISE EXCEPTION 'Journal entry is not balanced. Debits must equal credits.';
  END IF;

  IF jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'Journal entry must have at least 2 lines.';
  END IF;

  -- Use new type-based numbering system
  v_entry_number := generate_journal_entry_number(p_profile_id, p_entry_type);

  INSERT INTO journal_entries (
    profile_id, user_id, entry_date, entry_number,
    description, entry_type, source, status
  ) VALUES (
    p_profile_id, p_user_id, p_entry_date, v_entry_number,
    p_description, p_entry_type, p_source, 'posted'
  ) RETURNING id INTO v_entry_id;

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

  RETURN jsonb_build_object(
    'id', v_entry_id,
    'entry_number', v_entry_number,
    'entry_date', p_entry_date,
    'description', p_description,
    'entry_type', p_entry_type,
    'status', 'posted',
    'source', p_source
  );
END;
$$;
