/*
  # Automatic Rule Application on Transaction Insert

  1. New Functions
    - `auto_apply_rule_to_transaction()`: Automatically applies matching rules to new transactions
    
  2. New Triggers
    - Runs AFTER INSERT on transactions table
    - Only processes transactions in 'pending' status without existing category
    - Finds and applies first matching rule
    - Updates rule statistics
    
  3. Behavior
    - Silent background operation (no errors if no rules match)
    - Processes only uncategorized pending transactions
    - Applies rules in order of creation (oldest first)
*/

-- Function to automatically apply rules to a new transaction
CREATE OR REPLACE FUNCTION auto_apply_rule_to_transaction()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_rule record;
  v_matches boolean;
  v_description_lower text;
BEGIN
  -- Only process pending transactions without a category
  IF NEW.transaction_status != 'pending' OR NEW.chart_account_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Prepare lowercase description for case-insensitive matching
  v_description_lower := LOWER(NEW.original_description);

  -- Find first matching rule (ordered by created_at for consistency)
  FOR v_rule IN 
    SELECT * FROM transaction_rules
    WHERE profile_id = NEW.profile_id
      AND is_active = true
    ORDER BY created_at ASC
  LOOP
    v_matches := true;

    -- Check description condition
    IF v_rule.condition_description_contains IS NOT NULL THEN
      IF v_rule.condition_description_match_type = 'contains' THEN
        v_matches := v_matches AND (v_description_lower LIKE '%' || LOWER(v_rule.condition_description_contains) || '%');
      ELSIF v_rule.condition_description_match_type = 'exact' THEN
        v_matches := v_matches AND (v_description_lower = LOWER(v_rule.condition_description_contains));
      ELSIF v_rule.condition_description_match_type = 'starts_with' THEN
        v_matches := v_matches AND (v_description_lower LIKE LOWER(v_rule.condition_description_contains) || '%');
      ELSIF v_rule.condition_description_match_type = 'ends_with' THEN
        v_matches := v_matches AND (v_description_lower LIKE '%' || LOWER(v_rule.condition_description_contains));
      END IF;
    END IF;

    -- Check amount conditions
    IF v_rule.condition_amount_min IS NOT NULL THEN
      v_matches := v_matches AND (ABS(NEW.amount) >= v_rule.condition_amount_min);
    END IF;
    IF v_rule.condition_amount_max IS NOT NULL THEN
      v_matches := v_matches AND (ABS(NEW.amount) <= v_rule.condition_amount_max);
    END IF;

    -- Check transaction type condition
    IF v_rule.condition_transaction_type IS NOT NULL THEN
      v_matches := v_matches AND (NEW.transaction_type = v_rule.condition_transaction_type);
    END IF;

    -- Check account condition
    IF v_rule.condition_account_id IS NOT NULL THEN
      v_matches := v_matches AND (NEW.account_id = v_rule.condition_account_id);
    END IF;

    -- If rule matches, apply it
    IF v_matches THEN
      -- Update the transaction with rule actions
      UPDATE transactions SET
        chart_account_id = COALESCE(v_rule.action_set_category_id, chart_account_id),
        contact_id = COALESCE(v_rule.action_set_contact_id, contact_id),
        description = COALESCE(v_rule.action_set_description, description),
        applied_rule_id = v_rule.id
      WHERE id = NEW.id;

      -- Increment rule statistics
      UPDATE transaction_rules SET
        times_matched = times_matched + 1,
        last_matched_at = NOW()
      WHERE id = v_rule.id;

      -- Exit after applying first matching rule
      EXIT;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Create trigger on transactions table
DROP TRIGGER IF EXISTS trigger_auto_apply_rules_on_insert ON transactions;
CREATE TRIGGER trigger_auto_apply_rules_on_insert
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION auto_apply_rule_to_transaction();

-- Add comment for documentation
COMMENT ON FUNCTION auto_apply_rule_to_transaction() IS 'Automatically applies matching transaction rules to newly inserted transactions';
