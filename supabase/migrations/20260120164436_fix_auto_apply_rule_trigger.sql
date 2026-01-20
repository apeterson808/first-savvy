/*
  # Fix Auto-Apply Rule Trigger

  1. Overview
    Fixes the auto_apply_rule_on_change trigger to properly apply rules when created or updated.
    The previous implementation had numerous bugs including wrong column names and missing features.

  2. Changes
    - Rewrite auto_apply_rule_on_change() function to use existing apply_rule_to_transaction()
    - Support all rule matching conditions (bank accounts, money direction, descriptions)
    - Support all rule actions (category, contact, description, notes, auto-post)
    - Update applied_rule_id on affected transactions
    - Only process pending transactions without existing rules

  3. Behavior
    - When a rule is created or updated (if active)
    - Find all pending transactions that match the rule
    - Apply the rule to each matching transaction
    - Update rule statistics with match count

  4. Security
    - Uses SECURITY DEFINER with explicit search_path
    - Calls existing check_transaction_matches_rule() for validation
    - Updates only transactions in the same profile as the rule
*/

-- Replace the broken auto_apply_rule_on_change function
CREATE OR REPLACE FUNCTION auto_apply_rule_on_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_match_count integer := 0;
  v_transaction record;
  v_result jsonb;
BEGIN
  -- Only process enabled rules
  IF NOT NEW.is_enabled THEN
    RETURN NEW;
  END IF;

  -- Find all pending transactions in this profile that:
  -- 1. Don't have a category yet (chart_account_id IS NULL)
  -- 2. Don't have a rule already applied (applied_rule_id IS NULL)
  -- 3. Match the rule conditions
  FOR v_transaction IN
    SELECT id
    FROM transactions
    WHERE profile_id = NEW.profile_id
      AND transaction_status = 'pending'
      AND chart_account_id IS NULL
      AND applied_rule_id IS NULL
    ORDER BY transaction_date DESC
  LOOP
    -- Check if this transaction matches the rule using existing function
    IF public.check_transaction_matches_rule(v_transaction.id, NEW.id) THEN
      -- Apply the rule using existing function (which handles all actions)
      v_result := public.apply_rule_to_transaction(v_transaction.id, NEW.id, true);

      -- Check if application was successful
      IF (v_result->>'success')::boolean THEN
        v_match_count := v_match_count + 1;
      END IF;
    END IF;
  END LOOP;

  -- Note: Rule statistics are already updated by apply_rule_to_transaction(),
  -- but we need to update last_matched_at if there were matches
  IF v_match_count > 0 THEN
    UPDATE transaction_rules SET
      last_matched_at = NOW()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

-- Ensure the trigger is properly set up
DROP TRIGGER IF EXISTS trigger_auto_apply_rule_on_change ON transaction_rules;
CREATE TRIGGER trigger_auto_apply_rule_on_change
  AFTER INSERT OR UPDATE ON transaction_rules
  FOR EACH ROW
  EXECUTE FUNCTION auto_apply_rule_on_change();

-- Add comment for documentation
COMMENT ON FUNCTION auto_apply_rule_on_change() IS
  'Automatically applies a rule to all matching uncategorized pending transactions when the rule is created or updated. Uses check_transaction_matches_rule() and apply_rule_to_transaction() for validation and application.';
