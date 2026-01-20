/*
  # Update apply_rule_to_transaction to Store Rule ID

  1. Changes
    - Update `apply_rule_to_transaction()` function to set `applied_rule_id`
    - Fix column name from `category_account_id` to `chart_account_id`
    - Ensures manual rule application also tracks which rule was applied
    
  2. Purpose
    - Enable tracking of rule application for UI badge display
    - Maintain consistency between automatic and manual rule application
*/

CREATE OR REPLACE FUNCTION public.apply_rule_to_transaction(
  p_transaction_id uuid,
  p_rule_id uuid,
  p_update_transaction boolean DEFAULT true
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
  SELECT * INTO v_rule FROM transaction_rules WHERE id = p_rule_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rule not found or disabled');
  END IF;

  -- Check if rule matches
  IF NOT public.check_transaction_matches_rule(p_transaction_id, p_rule_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction does not match rule conditions');
  END IF;

  -- Build changes object and apply if requested
  IF v_rule.action_set_category_id IS NOT NULL THEN
    v_changes := jsonb_set(v_changes, '{chart_account_id}', to_jsonb(v_rule.action_set_category_id::text));
    IF p_update_transaction THEN
      UPDATE transactions
      SET chart_account_id = v_rule.action_set_category_id
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
    v_changes := jsonb_set(v_changes, '{transaction_status}', to_jsonb('posted'));
    UPDATE transactions
    SET transaction_status = 'posted'
    WHERE id = p_transaction_id;
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

COMMENT ON FUNCTION public.apply_rule_to_transaction(uuid, uuid, boolean) IS
  'Applies a transaction rule to a specific transaction and tracks which rule was applied via applied_rule_id';
