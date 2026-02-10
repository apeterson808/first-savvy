/*
  # Create Update Journal Entry Function

  1. Purpose
    - Allow direct editing of journal entries instead of reversal-based undo
    - Maintain full audit trail of changes in audit_logs table
    - Validate debits equal credits before saving
    - Check accounting period locks before allowing edits
  
  2. Function: update_journal_entry
    - Parameters: entry_id, new_description, array of line updates, edit_reason
    - Captures complete before/after state in audit_logs
    - Updates journal_entries and journal_entry_lines
    - Updates edit tracking columns (edited_at, edited_by, edit_count)
    - Recalculates account balances automatically via existing triggers
  
  3. Security
    - Verifies user has access via profile_memberships
    - Checks accounting period locks (if implemented)
    - Uses SECURITY DEFINER with safe search_path
*/

-- Create type for journal line updates
CREATE TYPE journal_line_update AS (
  account_id uuid,
  debit_amount numeric,
  credit_amount numeric,
  description text
);

-- Create update_journal_entry function
CREATE OR REPLACE FUNCTION update_journal_entry(
  p_entry_id uuid,
  p_new_description text,
  p_lines journal_line_update[],
  p_edit_reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_profile_id uuid;
  v_user_id uuid;
  v_entry_date date;
  v_entry_number text;
  v_total_debits numeric;
  v_total_credits numeric;
  v_old_state jsonb;
  v_new_state jsonb;
  v_old_lines jsonb;
  v_line journal_line_update;
  v_line_number integer;
  v_new_line_id uuid;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Get journal entry details and verify access
  SELECT je.profile_id, je.entry_date, je.entry_number
  INTO v_profile_id, v_entry_date, v_entry_number
  FROM journal_entries je
  WHERE je.id = p_entry_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Journal entry not found';
  END IF;

  -- Verify user has access to this profile
  IF NOT EXISTS (
    SELECT 1 FROM profile_memberships
    WHERE profile_id = v_profile_id
    AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied to this journal entry';
  END IF;

  -- Check if entry date is in a locked period (if periods exist)
  IF EXISTS (
    SELECT 1 FROM accounting_periods
    WHERE profile_id = v_profile_id
    AND v_entry_date >= period_start
    AND v_entry_date <= period_end
    AND is_locked = true
  ) THEN
    RAISE EXCEPTION 'Cannot edit journal entry in locked accounting period';
  END IF;

  -- Validate that debits equal credits
  v_total_debits := 0;
  v_total_credits := 0;
  
  FOREACH v_line IN ARRAY p_lines
  LOOP
    v_total_debits := v_total_debits + COALESCE(v_line.debit_amount, 0);
    v_total_credits := v_total_credits + COALESCE(v_line.credit_amount, 0);
  END LOOP;

  IF v_total_debits != v_total_credits THEN
    RAISE EXCEPTION 'Debits (%) must equal credits (%)', v_total_debits, v_total_credits;
  END IF;

  -- Capture old state for audit log
  SELECT jsonb_build_object(
    'entry_id', je.id,
    'entry_number', je.entry_number,
    'entry_date', je.entry_date,
    'description', je.description,
    'lines', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'line_id', jel.id,
          'line_number', jel.line_number,
          'account_id', jel.account_id,
          'account_number', ucoa.account_number,
          'account_name', COALESCE(ucoa.display_name, ucoa.account_name),
          'debit_amount', jel.debit_amount,
          'credit_amount', jel.credit_amount,
          'description', jel.description
        )
        ORDER BY jel.line_number
      )
      FROM journal_entry_lines jel
      JOIN user_chart_of_accounts ucoa ON ucoa.id = jel.account_id
      WHERE jel.journal_entry_id = je.id
    )
  ) INTO v_old_state
  FROM journal_entries je
  WHERE je.id = p_entry_id;

  -- Update journal entry description and edit tracking
  UPDATE journal_entries
  SET
    description = p_new_description,
    edited_at = now(),
    edited_by = v_user_id,
    edit_count = edit_count + 1,
    updated_at = now()
  WHERE id = p_entry_id;

  -- Delete existing journal entry lines
  DELETE FROM journal_entry_lines
  WHERE journal_entry_id = p_entry_id;

  -- Insert new lines
  v_line_number := 1;
  FOREACH v_line IN ARRAY p_lines
  LOOP
    INSERT INTO journal_entry_lines (
      journal_entry_id,
      profile_id,
      user_id,
      account_id,
      line_number,
      debit_amount,
      credit_amount,
      description
    ) VALUES (
      p_entry_id,
      v_profile_id,
      v_user_id,
      v_line.account_id,
      v_line_number,
      v_line.debit_amount,
      v_line.credit_amount,
      v_line.description
    );
    
    v_line_number := v_line_number + 1;
  END LOOP;

  -- Capture new state for audit log
  SELECT jsonb_build_object(
    'entry_id', je.id,
    'entry_number', je.entry_number,
    'entry_date', je.entry_date,
    'description', je.description,
    'lines', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'line_id', jel.id,
          'line_number', jel.line_number,
          'account_id', jel.account_id,
          'account_number', ucoa.account_number,
          'account_name', COALESCE(ucoa.display_name, ucoa.account_name),
          'debit_amount', jel.debit_amount,
          'credit_amount', jel.credit_amount,
          'description', jel.description
        )
        ORDER BY jel.line_number
      )
      FROM journal_entry_lines jel
      JOIN user_chart_of_accounts ucoa ON ucoa.id = jel.account_id
      WHERE jel.journal_entry_id = je.id
    )
  ) INTO v_new_state
  FROM journal_entries je
  WHERE je.id = p_entry_id;

  -- Write audit log entry
  INSERT INTO audit_logs (
    profile_id,
    user_id,
    action,
    entity_type,
    entity_id,
    description,
    metadata
  ) VALUES (
    v_profile_id,
    v_user_id,
    'edit_journal_entry',
    'journal_entry',
    p_entry_id,
    COALESCE(p_edit_reason, 'Edited journal entry ' || v_entry_number),
    jsonb_build_object(
      'entry_number', v_entry_number,
      'edit_reason', p_edit_reason,
      'old_state', v_old_state,
      'new_state', v_new_state,
      'edited_at', now()
    )
  );

  -- Return success with updated entry details
  RETURN jsonb_build_object(
    'success', true,
    'entry_id', p_entry_id,
    'entry_number', v_entry_number,
    'edit_count', (SELECT edit_count FROM journal_entries WHERE id = p_entry_id),
    'message', 'Journal entry updated successfully'
  );
END;
$$;

COMMENT ON FUNCTION update_journal_entry IS
'Edit a journal entry in place with full audit trail. 
Validates debits equal credits, checks period locks, captures before/after state in audit_logs.
Replaces reversal-based undo system with direct editing.';

GRANT EXECUTE ON FUNCTION update_journal_entry TO authenticated;
