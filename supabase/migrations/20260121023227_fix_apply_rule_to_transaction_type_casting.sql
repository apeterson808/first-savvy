/*
  # Fix Apply Rule to Transaction - Type Casting Error

  1. Problem
    The apply_rule_to_transaction function has a type casting error when setting status to 'posted'.
    Error: "could not determine polymorphic type because input has type unknown"
    
  2. Fix
    Explicitly cast 'posted' to text::jsonb instead of using to_jsonb('posted')
    
  3. Impact
    - Rules with auto_confirm_and_post enabled will now work correctly
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
  v_update_data jsonb := '{}';
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

  -- Build changes object and apply if requested
  IF v_rule.action_set_category_id IS NOT NULL THEN
    v_changes := jsonb_set(v_changes, '{category_account_id}', to_jsonb(v_rule.action_set_category_id::text));
    IF p_update_transaction THEN
      UPDATE transactions
      SET category_account_id = v_rule.action_set_category_id
      WHERE id = p_transaction_id;
    END IF;
  END IF;

  IF v_rule.action_set_contact_id IS NOT NULL THEN
    v_changes := jsonb_set(v_changes, '{contact_id}', to_jsonb(v_rule.action_set_contact_id::text));
    IF p_update_transaction THEN
      UPDATE transactions
      SET contact_id = v_rule.action_set_contact_id
      WHERE id = p_transaction_id;
    END IF;
  END IF;

  IF v_rule.action_set_description IS NOT NULL THEN
    v_changes := jsonb_set(v_changes, '{description}', to_jsonb(v_rule.action_set_description));
    IF p_update_transaction THEN
      UPDATE transactions
      SET description = v_rule.action_set_description
      WHERE id = p_transaction_id;
    END IF;
  END IF;

  IF v_rule.action_add_note IS NOT NULL THEN
    v_changes := jsonb_set(v_changes, '{note}', to_jsonb(v_rule.action_add_note));
    IF p_update_transaction THEN
      UPDATE transactions
      SET notes = COALESCE(notes || E'\n', '') || v_rule.action_add_note
      WHERE id = p_transaction_id;
    END IF;
  END IF;

  -- Auto-confirm and post if enabled
  IF v_rule.auto_confirm_and_post AND p_update_transaction THEN
    v_changes := jsonb_set(v_changes, '{status}', '"posted"'::jsonb);

    -- Set session flag to authorize status change
    PERFORM set_config('app.internal_status_write', 'true', true);

    -- Update status
    UPDATE transactions
    SET status = 'posted'
    WHERE id = p_transaction_id;

    -- Clear session flag
    PERFORM set_config('app.internal_status_write', 'false', true);
  END IF;

  -- Set the applied_rule_id to track which rule was applied
  IF p_update_transaction THEN
    v_changes := jsonb_set(v_changes, '{applied_rule_id}', to_jsonb(p_rule_id::text));
    UPDATE transactions
    SET applied_rule_id = p_rule_id
    WHERE id = p_transaction_id;
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
'Applies a transaction rule to a transaction. Sets session flag for status changes when auto_confirm_and_post is enabled.';
