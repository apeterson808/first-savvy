/*
  # Update Journal Entry Functions

  1. Updates
    - Fix `get_journal_entry_with_lines` to include icon and color fields
    - Create `update_journal_entry_with_lines` function to update entry and lines
    - Only allow updating description and line amounts (not accounts)
    - Validate debits equal credits before saving

  2. Security
    - SECURITY DEFINER with proper search_path
    - Validates profile_id matches for security
    - Only allows editing manual entries and opening balance entries
*/

-- ============================================================================
-- Update get_journal_entry_with_lines to include icon and color
-- ============================================================================

DROP FUNCTION IF EXISTS get_journal_entry_with_lines(uuid);

CREATE OR REPLACE FUNCTION get_journal_entry_with_lines(p_entry_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'id', je.id,
    'profile_id', je.profile_id,
    'user_id', je.user_id,
    'entry_date', je.entry_date,
    'entry_number', je.entry_number,
    'description', je.description,
    'entry_type', je.entry_type,
    'source', je.source,
    'created_at', je.created_at,
    'updated_at', je.updated_at,
    'lines', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'id', jel.id,
          'line_number', jel.line_number,
          'account_id', jel.account_id,
          'account_number', ucoa.account_number,
          'account_name', COALESCE(ucoa.display_name, t.display_name),
          'account_icon', ucoa.icon,
          'account_color', ucoa.color,
          'debit_amount', jel.debit_amount,
          'credit_amount', jel.credit_amount,
          'description', jel.description
        ) ORDER BY jel.line_number
      )
      FROM journal_entry_lines jel
      JOIN user_chart_of_accounts ucoa ON jel.account_id = ucoa.id
      LEFT JOIN chart_of_accounts_templates t ON ucoa.template_account_number = t.account_number
      WHERE jel.journal_entry_id = je.id
    ),
    'total_debits', (
      SELECT COALESCE(SUM(debit_amount), 0)
      FROM journal_entry_lines WHERE journal_entry_id = je.id
    ),
    'total_credits', (
      SELECT COALESCE(SUM(credit_amount), 0)
      FROM journal_entry_lines WHERE journal_entry_id = je.id
    )
  ) INTO v_result
  FROM journal_entries je
  WHERE je.id = p_entry_id;
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_journal_entry_with_lines IS
'Returns complete journal entry with all lines including icon and color for display.';

-- ============================================================================
-- Create update_journal_entry_with_lines Function
-- ============================================================================

CREATE OR REPLACE FUNCTION update_journal_entry_with_lines(
  p_entry_id uuid,
  p_profile_id uuid,
  p_description text,
  p_lines jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_entry journal_entries;
  v_line jsonb;
  v_total_debits numeric := 0;
  v_total_credits numeric := 0;
  v_line_id uuid;
  v_debit_amount numeric;
  v_credit_amount numeric;
  v_line_description text;
BEGIN
  -- Verify the entry exists and belongs to this profile
  SELECT * INTO v_entry
  FROM journal_entries
  WHERE id = p_entry_id AND profile_id = p_profile_id;

  IF v_entry IS NULL THEN
    RAISE EXCEPTION 'Journal entry not found or access denied';
  END IF;

  -- Only allow editing manual or opening_balance entries
  IF v_entry.source NOT IN ('manual', 'opening_balance') THEN
    RAISE EXCEPTION 'Only manual and opening balance journal entries can be edited';
  END IF;

  -- Calculate totals and validate
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_debit_amount := COALESCE((v_line->>'debit_amount')::numeric, 0);
    v_credit_amount := COALESCE((v_line->>'credit_amount')::numeric, 0);
    v_total_debits := v_total_debits + v_debit_amount;
    v_total_credits := v_total_credits + v_credit_amount;
  END LOOP;

  -- Validate debits equal credits
  IF ABS(v_total_debits - v_total_credits) > 0.01 THEN
    RAISE EXCEPTION 'Journal entry must be balanced. Debits: %, Credits: %', v_total_debits, v_total_credits;
  END IF;

  -- Update the journal entry description
  UPDATE journal_entries
  SET 
    description = p_description,
    updated_at = now()
  WHERE id = p_entry_id;

  -- Update each line
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_line_id := (v_line->>'id')::uuid;
    v_debit_amount := COALESCE((v_line->>'debit_amount')::numeric, 0);
    v_credit_amount := COALESCE((v_line->>'credit_amount')::numeric, 0);
    v_line_description := v_line->>'description';

    UPDATE journal_entry_lines
    SET
      debit_amount = v_debit_amount,
      credit_amount = v_credit_amount,
      description = v_line_description,
      updated_at = now()
    WHERE id = v_line_id AND journal_entry_id = p_entry_id;
  END LOOP;

  -- Update account balances for all affected accounts
  PERFORM update_account_balance_from_journal_lines(p_entry_id);

  -- Return the updated entry
  RETURN get_journal_entry_with_lines(p_entry_id);
END;
$$;

COMMENT ON FUNCTION update_journal_entry_with_lines IS
'Updates a journal entry description and line amounts. Only works for manual and opening_balance entries. Validates that debits equal credits.';
