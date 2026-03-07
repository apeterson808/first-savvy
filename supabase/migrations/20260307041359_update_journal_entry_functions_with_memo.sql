/*
  # Update Journal Entry Functions to Support Memo Field

  1. Changes
    - Update `update_journal_entry_with_lines` function to accept and save memo parameter
    - Ensure memo field is properly handled during journal entry updates

  2. Notes
    - Maintains backward compatibility
    - Preserves all existing functionality
*/

-- Update the update_journal_entry_with_lines function to include memo
CREATE OR REPLACE FUNCTION update_journal_entry_with_lines(
  p_entry_id uuid,
  p_profile_id uuid,
  p_description text,
  p_memo text DEFAULT NULL,
  p_lines jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_line jsonb;
  v_result jsonb;
  v_total_debits numeric := 0;
  v_total_credits numeric := 0;
BEGIN
  -- Get current user
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify user has access to this profile
  IF NOT EXISTS (
    SELECT 1 FROM profile_memberships
    WHERE profile_id = p_profile_id
    AND user_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Access denied to this profile';
  END IF;

  -- Verify entry exists and belongs to profile
  IF NOT EXISTS (
    SELECT 1 FROM journal_entries
    WHERE id = p_entry_id
    AND profile_id = p_profile_id
  ) THEN
    RAISE EXCEPTION 'Journal entry not found';
  END IF;

  -- Check if entry is locked
  IF EXISTS (
    SELECT 1 FROM journal_entries
    WHERE id = p_entry_id
    AND status = 'locked'
  ) THEN
    RAISE EXCEPTION 'Cannot edit locked journal entry';
  END IF;

  -- Calculate totals and validate balance
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    v_total_debits := v_total_debits + COALESCE((v_line->>'debit_amount')::numeric, 0);
    v_total_credits := v_total_credits + COALESCE((v_line->>'credit_amount')::numeric, 0);
  END LOOP;

  -- Validate balance
  IF ABS(v_total_debits - v_total_credits) > 0.01 THEN
    RAISE EXCEPTION 'Journal entry is not balanced. Debits: %, Credits: %', v_total_debits, v_total_credits;
  END IF;

  -- Update journal entry header
  UPDATE journal_entries
  SET 
    description = p_description,
    memo = p_memo,
    updated_at = now(),
    edited_at = now(),
    edited_by = v_user_id,
    edit_count = edit_count + 1
  WHERE id = p_entry_id;

  -- Update journal entry lines
  FOR v_line IN SELECT * FROM jsonb_array_elements(p_lines)
  LOOP
    UPDATE journal_entry_lines
    SET
      debit_amount = COALESCE((v_line->>'debit_amount')::numeric, 0),
      credit_amount = COALESCE((v_line->>'credit_amount')::numeric, 0),
      description = v_line->>'description'
    WHERE id = (v_line->>'id')::uuid
    AND journal_entry_id = p_entry_id;
  END LOOP;

  -- Update account balances
  PERFORM update_account_balance_from_journal(p_entry_id);

  -- Log the edit in audit trail
  INSERT INTO audit_logs (
    profile_id,
    user_id,
    action,
    entity_type,
    entity_id,
    description,
    metadata
  ) VALUES (
    p_profile_id,
    v_user_id,
    'edit_journal_entry',
    'journal_entry',
    p_entry_id,
    'Journal entry edited',
    jsonb_build_object(
      'description', p_description,
      'memo', p_memo,
      'total_debits', v_total_debits,
      'total_credits', v_total_credits
    )
  );

  -- Return updated entry
  SELECT jsonb_build_object(
    'id', id,
    'entry_number', entry_number,
    'description', description,
    'memo', memo,
    'updated_at', updated_at
  ) INTO v_result
  FROM journal_entries
  WHERE id = p_entry_id;

  RETURN v_result;
END;
$$;