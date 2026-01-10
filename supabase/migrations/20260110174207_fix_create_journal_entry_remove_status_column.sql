/*
  # Fix create_journal_entry Function - Remove Status Column

  ## Problem
  The create_journal_entry function tries to INSERT a 'status' column that doesn't exist
  in the journal_entries table. This causes 400 errors when importing accounts.

  Error: column "status" of relation "journal_entries" does not exist

  ## Root Cause
  Migration 20260110152414 added status column to INSERT statement
  But migration 20260110050852 created journal_entries table WITHOUT status column
  Migration 20260107134050 was supposed to remove status but got overwritten

  ## Solution
  Remove 'status' column from:
  1. INSERT INTO journal_entries column list
  2. VALUES list (remove 'posted')
  3. Return object (remove status field)

  ## Impact
  - Account imports will work correctly
  - Opening balance journal entries will be created successfully
  - No more "column status does not exist" errors
*/

-- Drop and recreate function without status column
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
BEGIN
  IF NOT validate_journal_entry_balance(p_lines) THEN
    RAISE EXCEPTION 'Journal entry is not balanced. Debits must equal credits.';
  END IF;

  IF jsonb_array_length(p_lines) < 2 THEN
    RAISE EXCEPTION 'Journal entry must have at least 2 lines.';
  END IF;

  -- Use type-based numbering system
  v_entry_number := generate_journal_entry_number(p_profile_id, p_entry_type);

  -- FIXED: Removed 'status' column from INSERT (doesn't exist in table)
  INSERT INTO journal_entries (
    profile_id, user_id, entry_date, entry_number,
    description, entry_type, source
  ) VALUES (
    p_profile_id, p_user_id, p_entry_date, v_entry_number,
    p_description, p_entry_type, p_source
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

  -- FIXED: Removed 'status' field from return object
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
'Creates a journal entry with multiple lines. Status column removed as it does not exist in journal_entries table.';
