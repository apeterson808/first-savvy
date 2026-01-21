/*
  # Fix Auto-Apply Rule on Change - Reprocess Existing Matches

  1. Problem
    When a rule is updated to enable auto_confirm_and_post, transactions that were
    already matched by that rule (with applied_rule_id set) are skipped. This means
    enabling auto-post on an existing rule doesn't post the previously matched transactions.

  2. Solution
    Update auto_apply_rule_on_change to:
    - Apply to NEW pending transactions without any rule (applied_rule_id IS NULL)
    - ALSO re-process pending transactions that were matched by THIS SPECIFIC rule
    - This allows updating auto_confirm_and_post to affect already-matched transactions

  3. Impact
    - Updating a rule to enable auto-post will now post all pending transactions matched by that rule
    - Changing other rule settings will also re-apply the rule to its existing matches
*/

CREATE OR REPLACE FUNCTION auto_apply_rule_on_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction record;
  v_result jsonb;
  v_match_count integer := 0;
BEGIN
  -- Only process enabled rules
  IF NOT NEW.is_enabled THEN
    RETURN NEW;
  END IF;

  -- Find all matching pending transactions:
  -- 1. Transactions without any applied rule (new matches)
  -- 2. Transactions that were previously matched by THIS rule (re-apply for auto-post changes)
  FOR v_transaction IN
    SELECT id FROM transactions
    WHERE profile_id = NEW.profile_id
      AND status = 'pending'
      AND (applied_rule_id IS NULL OR applied_rule_id = NEW.id)
    ORDER BY date DESC
  LOOP
    -- Check if this transaction matches the rule
    IF public.check_transaction_matches_rule(v_transaction.id, NEW.id) THEN
      -- Apply the rule (this will update status if auto_confirm_and_post is enabled)
      v_result := public.apply_rule_to_transaction(v_transaction.id, NEW.id, true);

      IF (v_result->>'success')::boolean THEN
        v_match_count := v_match_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_apply_rule_on_change() IS
'Automatically applies a rule to all matching pending transactions when the rule is created or updated. Includes transactions previously matched by this specific rule, allowing auto-post changes to take effect.';
