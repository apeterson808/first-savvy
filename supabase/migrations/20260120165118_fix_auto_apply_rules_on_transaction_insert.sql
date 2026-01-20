/*
  # Fix Auto-Apply Rules on Transaction Insert

  1. Overview
    Fixes the auto_apply_rule_to_transaction trigger to properly apply rules to newly inserted transactions.
    The previous implementation had wrong column names and didn't use the existing helper functions.

  2. Changes
    - Rewrite auto_apply_rule_to_transaction() function with correct column names
    - Use existing check_transaction_matches_rule() and apply_rule_to_transaction() functions
    - Only process pending transactions without categories or applied rules
    - Support all rule matching conditions and actions

  3. Behavior
    - Runs AFTER INSERT on transactions table
    - Only processes pending transactions
    - Only processes transactions without chart_account_id or applied_rule_id
    - Applies first matching enabled rule (ordered by created_at)
    - Updates rule statistics automatically

  4. Security
    - Uses SECURITY DEFINER with explicit search_path
    - Validates rule and transaction belong to same profile
*/

-- Replace the broken auto_apply_rule_to_transaction function
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

-- Ensure the trigger is properly set up
DROP TRIGGER IF EXISTS trigger_auto_apply_rules_on_insert ON transactions;
CREATE TRIGGER trigger_auto_apply_rules_on_insert
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION auto_apply_rule_to_transaction();

-- Add comment for documentation
COMMENT ON FUNCTION auto_apply_rule_to_transaction() IS
  'Automatically applies the first matching enabled rule to newly inserted pending transactions without categories. Uses check_transaction_matches_rule() and apply_rule_to_transaction() for validation and application.';
