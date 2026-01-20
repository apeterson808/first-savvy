/*
  # Fix Auto Apply Rules Trigger - Match Actual Schema
  
  1. Changes
    - Fix all column names to match actual transaction_rules schema
    - `condition_*` → `match_*`
    - `action_set_*` properly aligned with schema
    
  2. Column Mappings
    - condition_description_contains → match_description_pattern
    - condition_description_match_type → match_description_mode
    - condition_transaction_type → match_transaction_type
    - condition_account_id → match_bank_account_id
    - condition_amount_min/max → match_amount_min/max
*/

-- Fix the auto_apply_rule_to_transaction function with correct schema
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
  IF NEW.status != 'pending' OR NEW.category_account_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Prepare lowercase description for case-insensitive matching
  v_description_lower := LOWER(NEW.original_description);

  -- Find first matching rule (ordered by created_at for consistency)
  FOR v_rule IN 
    SELECT * FROM transaction_rules
    WHERE profile_id = NEW.profile_id
      AND is_enabled = true
    ORDER BY created_at ASC
  LOOP
    v_matches := true;

    -- Check description condition
    IF v_rule.match_description_pattern IS NOT NULL THEN
      IF v_rule.match_case_sensitive THEN
        -- Case-sensitive matching
        IF v_rule.match_description_mode = 'contains' THEN
          v_matches := v_matches AND (NEW.original_description LIKE '%' || v_rule.match_description_pattern || '%');
        ELSIF v_rule.match_description_mode = 'exact' THEN
          v_matches := v_matches AND (NEW.original_description = v_rule.match_description_pattern);
        ELSIF v_rule.match_description_mode = 'starts_with' THEN
          v_matches := v_matches AND (NEW.original_description LIKE v_rule.match_description_pattern || '%');
        ELSIF v_rule.match_description_mode = 'ends_with' THEN
          v_matches := v_matches AND (NEW.original_description LIKE '%' || v_rule.match_description_pattern);
        END IF;
      ELSE
        -- Case-insensitive matching
        IF v_rule.match_description_mode = 'contains' THEN
          v_matches := v_matches AND (v_description_lower LIKE '%' || LOWER(v_rule.match_description_pattern) || '%');
        ELSIF v_rule.match_description_mode = 'exact' THEN
          v_matches := v_matches AND (v_description_lower = LOWER(v_rule.match_description_pattern));
        ELSIF v_rule.match_description_mode = 'starts_with' THEN
          v_matches := v_matches AND (v_description_lower LIKE LOWER(v_rule.match_description_pattern) || '%');
        ELSIF v_rule.match_description_mode = 'ends_with' THEN
          v_matches := v_matches AND (v_description_lower LIKE '%' || LOWER(v_rule.match_description_pattern));
        END IF;
      END IF;
    END IF;

    -- Check amount conditions
    IF v_rule.match_amount_min IS NOT NULL THEN
      v_matches := v_matches AND (ABS(NEW.amount) >= v_rule.match_amount_min);
    END IF;
    IF v_rule.match_amount_max IS NOT NULL THEN
      v_matches := v_matches AND (ABS(NEW.amount) <= v_rule.match_amount_max);
    END IF;
    IF v_rule.match_amount_exact IS NOT NULL THEN
      v_matches := v_matches AND (ABS(NEW.amount) = v_rule.match_amount_exact);
    END IF;

    -- Check transaction type condition
    IF v_rule.match_transaction_type IS NOT NULL THEN
      v_matches := v_matches AND (NEW.type = v_rule.match_transaction_type);
    END IF;

    -- Check account condition
    IF v_rule.match_bank_account_id IS NOT NULL THEN
      v_matches := v_matches AND (NEW.bank_account_id = v_rule.match_bank_account_id);
    END IF;

    -- If rule matches, apply it
    IF v_matches THEN
      -- Update the transaction with rule actions
      UPDATE transactions SET
        category_account_id = COALESCE(v_rule.action_set_category_id, category_account_id),
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
