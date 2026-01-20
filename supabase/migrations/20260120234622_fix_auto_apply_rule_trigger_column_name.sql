/*
  # Fix auto_apply_rule_to_transaction Trigger - Correct Column Name

  1. Overview
    The auto_apply_rule_to_transaction trigger was checking for category_account_id
    but the actual column name is chart_account_id.

  2. Changes
    - Update trigger to use chart_account_id instead of category_account_id
    - Ensures rules are properly applied to uncategorized transactions

  3. Impact
    - Rules will now be applied to newly inserted transactions correctly
*/

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
  IF NEW.status != 'pending' OR NEW.chart_account_id IS NOT NULL OR NEW.applied_rule_id IS NOT NULL THEN
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

COMMENT ON FUNCTION auto_apply_rule_to_transaction() IS
  'Automatically applies the first matching enabled rule to newly inserted pending transactions without categories. Uses check_transaction_matches_rule() and apply_rule_to_transaction() for validation and application.';
