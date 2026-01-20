/*
  # Automatic Rule Application on Rule Creation/Update

  1. New Functions
    - `auto_apply_rule_on_change()`: Applies a rule to all matching transactions when rule is created or updated
    
  2. New Triggers
    - Runs AFTER INSERT OR UPDATE on transaction_rules table
    - Only processes active rules
    - Finds all matching pending transactions without categories
    - Applies the rule to them
    - Updates rule statistics
    
  3. Behavior
    - Background batch operation
    - Only affects uncategorized pending transactions
    - Updates rule statistics with total matches
*/

-- Function to apply a rule to all matching transactions when rule is created/updated
CREATE OR REPLACE FUNCTION auto_apply_rule_on_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_match_count integer := 0;
  v_transaction record;
  v_matches boolean;
  v_description_lower text;
BEGIN
  -- Only process active rules
  IF NOT NEW.is_active THEN
    RETURN NEW;
  END IF;

  -- Find all matching pending transactions without categories
  FOR v_transaction IN 
    SELECT * FROM transactions
    WHERE profile_id = NEW.profile_id
      AND transaction_status = 'pending'
      AND chart_account_id IS NULL
      AND applied_rule_id IS NULL
    ORDER BY transaction_date DESC
  LOOP
    v_matches := true;
    v_description_lower := LOWER(v_transaction.original_description);

    -- Check description condition
    IF NEW.condition_description_contains IS NOT NULL THEN
      IF NEW.condition_description_match_type = 'contains' THEN
        v_matches := v_matches AND (v_description_lower LIKE '%' || LOWER(NEW.condition_description_contains) || '%');
      ELSIF NEW.condition_description_match_type = 'exact' THEN
        v_matches := v_matches AND (v_description_lower = LOWER(NEW.condition_description_contains));
      ELSIF NEW.condition_description_match_type = 'starts_with' THEN
        v_matches := v_matches AND (v_description_lower LIKE LOWER(NEW.condition_description_contains) || '%');
      ELSIF NEW.condition_description_match_type = 'ends_with' THEN
        v_matches := v_matches AND (v_description_lower LIKE '%' || LOWER(NEW.condition_description_contains));
      END IF;
    END IF;

    -- Check amount conditions
    IF NEW.condition_amount_min IS NOT NULL THEN
      v_matches := v_matches AND (ABS(v_transaction.amount) >= NEW.condition_amount_min);
    END IF;
    IF NEW.condition_amount_max IS NOT NULL THEN
      v_matches := v_matches AND (ABS(v_transaction.amount) <= NEW.condition_amount_max);
    END IF;

    -- Check transaction type condition
    IF NEW.condition_transaction_type IS NOT NULL THEN
      v_matches := v_matches AND (v_transaction.transaction_type = NEW.condition_transaction_type);
    END IF;

    -- Check account condition
    IF NEW.condition_account_id IS NOT NULL THEN
      v_matches := v_matches AND (v_transaction.account_id = NEW.condition_account_id);
    END IF;

    -- If transaction matches, apply the rule
    IF v_matches THEN
      UPDATE transactions SET
        chart_account_id = COALESCE(NEW.action_set_category_id, chart_account_id),
        contact_id = COALESCE(NEW.action_set_contact_id, contact_id),
        description = COALESCE(NEW.action_set_description, description),
        applied_rule_id = NEW.id
      WHERE id = v_transaction.id;

      v_match_count := v_match_count + 1;
    END IF;
  END LOOP;

  -- Update rule statistics
  IF v_match_count > 0 THEN
    UPDATE transaction_rules SET
      times_matched = times_matched + v_match_count,
      last_matched_at = NOW()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger on transaction_rules table
DROP TRIGGER IF EXISTS trigger_auto_apply_rule_on_change ON transaction_rules;
CREATE TRIGGER trigger_auto_apply_rule_on_change
  AFTER INSERT OR UPDATE ON transaction_rules
  FOR EACH ROW
  EXECUTE FUNCTION auto_apply_rule_on_change();

-- Add comment for documentation
COMMENT ON FUNCTION auto_apply_rule_on_change() IS 'Automatically applies a rule to all matching transactions when the rule is created or updated';
