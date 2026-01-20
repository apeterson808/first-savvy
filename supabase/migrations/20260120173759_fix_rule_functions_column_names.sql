/*
  # Fix Rule Functions - Correct Column Names

  1. Overview
    Fixes all rule-related functions to use correct column names from transactions table

  2. Changes
    - Update apply_rule_to_transaction to use 'category_account_id' instead of 'chart_account_id'
    - Update apply_rule_to_transaction to use 'status' instead of 'transaction_status'
    - Update apply_rule_to_transaction to use 'is_enabled' instead of 'is_active'
    - Update auto_apply_rule_to_transaction to use 'category_account_id' instead of 'chart_account_id'

  3. Impact
    - Rules can now be created and applied without database errors
*/

-- Fix apply_rule_to_transaction function
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
    v_changes := jsonb_set(v_changes, '{status}', to_jsonb('posted'));
    UPDATE transactions
    SET status = 'posted'
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

-- Fix auto_apply_rule_to_transaction function
CREATE OR REPLACE FUNCTION auto_apply_rule_to_transaction()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_rule record;
  v_result jsonb;
BEGIN
  -- Only process pending transactions without a category or applied rule
  IF NEW.status != 'pending' OR NEW.category_account_id IS NOT NULL OR NEW.applied_rule_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Find first matching enabled rule (ordered by created_at for consistency)
  FOR v_rule IN
    SELECT id
    FROM transaction_rules
    WHERE profile_id = NEW.profile_id
      AND is_enabled = true
    ORDER BY created_at ASC
  LOOP
    -- Check if this transaction matches the rule using existing function
    IF public.check_transaction_matches_rule(NEW.id, v_rule.id) THEN
      -- Apply the rule using existing function (which handles all actions and statistics)
      v_result := public.apply_rule_to_transaction(NEW.id, v_rule.id, true);

      -- Exit after applying first matching rule
      IF (v_result->>'success')::boolean THEN
        EXIT;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;