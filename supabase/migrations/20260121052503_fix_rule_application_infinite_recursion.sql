/*
  # Fix Rule Application Infinite Recursion

  1. Problem
    - apply_rule_to_transaction updates the transaction multiple times (once per field)
    - Each UPDATE triggers auto_apply_rule_to_transaction again
    - applied_rule_id is set last, so earlier updates cause infinite recursion
    
  2. Solution
    - Combine all transaction updates into a single UPDATE statement
    - This triggers the auto_apply_rule_to_transaction trigger only once
    - The applied_rule_id is set in the same UPDATE, preventing recursion

  3. Impact
    - Rules will now apply correctly without infinite loops
    - Better performance (one UPDATE instead of 5+)
    - No more stack depth errors
*/

CREATE OR REPLACE FUNCTION apply_rule_to_transaction(
  p_transaction_id uuid,
  p_rule_id uuid,
  p_update_transaction boolean DEFAULT false
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_rule record;
  v_changes jsonb := '{}';
  v_new_status text := NULL;
BEGIN
  -- Get rule
  SELECT * INTO v_rule FROM transaction_rules WHERE id = p_rule_id AND is_enabled = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rule not found or disabled');
  END IF;

  -- Check if rule matches
  IF NOT public.check_transaction_matches_rule(p_transaction_id, p_rule_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction does not match rule conditions');
  END IF;

  -- Build changes object
  IF v_rule.action_set_category_id IS NOT NULL THEN
    v_changes := jsonb_set(v_changes, '{category_account_id}', to_jsonb(v_rule.action_set_category_id::text));
  END IF;

  IF v_rule.action_set_contact_id IS NOT NULL THEN
    v_changes := jsonb_set(v_changes, '{contact_id}', to_jsonb(v_rule.action_set_contact_id::text));
  END IF;

  IF v_rule.action_set_description IS NOT NULL THEN
    v_changes := jsonb_set(v_changes, '{description}', to_jsonb(v_rule.action_set_description));
  END IF;

  IF v_rule.action_add_note IS NOT NULL THEN
    v_changes := jsonb_set(v_changes, '{note}', to_jsonb(v_rule.action_add_note));
  END IF;

  -- Check if we should auto-confirm and post
  IF v_rule.auto_confirm_and_post THEN
    v_changes := jsonb_set(v_changes, '{status}', '"posted"'::jsonb);
    v_new_status := 'posted';
  END IF;

  -- Always set applied_rule_id
  v_changes := jsonb_set(v_changes, '{applied_rule_id}', to_jsonb(p_rule_id::text));

  -- Apply all changes in a single UPDATE statement to prevent recursion
  IF p_update_transaction THEN
    -- Set session flag to authorize status change if needed
    IF v_new_status IS NOT NULL THEN
      PERFORM set_config('app.internal_status_write', 'true', true);
    END IF;

    -- Single UPDATE with all changes
    UPDATE transactions
    SET
      category_account_id = COALESCE(v_rule.action_set_category_id, category_account_id),
      contact_id = COALESCE(v_rule.action_set_contact_id, contact_id),
      description = COALESCE(v_rule.action_set_description, description),
      notes = CASE 
        WHEN v_rule.action_add_note IS NOT NULL 
        THEN COALESCE(notes || E'\n', '') || v_rule.action_add_note 
        ELSE notes 
      END,
      status = COALESCE(v_new_status, status),
      applied_rule_id = p_rule_id
    WHERE id = p_transaction_id;

    -- Clear session flag
    IF v_new_status IS NOT NULL THEN
      PERFORM set_config('app.internal_status_write', 'false', true);
    END IF;
  END IF;

  -- Update rule statistics
  UPDATE transaction_rules
  SET
    times_matched = times_matched + 1,
    last_matched_at = now()
  WHERE id = p_rule_id;

  RETURN jsonb_build_object(
    'success', true,
    'changes', v_changes,
    'rule_name', v_rule.name
  );
END;
$$;

COMMENT ON FUNCTION apply_rule_to_transaction IS
'Applies a transaction rule to a transaction. Uses a single UPDATE to prevent trigger recursion.';
