/*
  # Disable Auto-Apply on Rule Creation to Prevent Timeouts

  1. Problem
    - Creating a new rule tries to auto-apply it to up to 100 transactions
    - This causes database timeout (statement timeout) for users with many transactions
    - Rule creation should be instant

  2. Solution
    - Only auto-apply on UPDATE, not INSERT
    - Rule creation is now instant
    - Users can manually apply rules using "Apply Rules" button
    - On rule UPDATE (edit), we still auto-apply with a smaller limit (25 transactions)

  3. Impact
    - Rule creation is now instant and never times out
    - Rules can still be applied manually or will auto-apply when edited
    - Better UX - rules are created immediately
*/

-- Drop and recreate the trigger to only fire on UPDATE, not INSERT
DROP TRIGGER IF EXISTS trigger_auto_apply_rule_on_change ON public.transaction_rules;

CREATE TRIGGER trigger_auto_apply_rule_on_change
  AFTER UPDATE ON public.transaction_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_apply_rule_on_change();

-- Update the function to reduce the limit from 100 to 25 for better performance
CREATE OR REPLACE FUNCTION public.auto_apply_rule_on_change()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction RECORD;
  v_result jsonb;
  v_processed_count integer := 0;
  v_max_transactions integer := 25;  -- Reduced from 100 to 25
  v_error_count integer := 0;
BEGIN
  -- Only process if rule is enabled
  IF NEW.is_enabled = false THEN
    RETURN NEW;
  END IF;

  -- Only process if relevant fields changed
  IF OLD.is_enabled = NEW.is_enabled 
     AND OLD.match_description_pattern = NEW.match_description_pattern
     AND OLD.match_bank_account_ids = NEW.match_bank_account_ids
     AND OLD.match_money_direction = NEW.match_money_direction
     AND OLD.match_conditions_logic = NEW.match_conditions_logic
     AND OLD.action_set_category_id = NEW.action_set_category_id
     AND OLD.action_set_contact_id = NEW.action_set_contact_id THEN
    RETURN NEW;
  END IF;

  -- Loop through pending transactions that match this rule's profile
  -- Only process transactions without an applied rule, or those that used this rule
  BEGIN
    FOR v_transaction IN
      SELECT t.id
      FROM public.transactions t
      WHERE t.profile_id = NEW.profile_id
        AND t.status = 'pending'
        AND (t.applied_rule_id IS NULL OR t.applied_rule_id = NEW.id)
      ORDER BY t.date DESC
      LIMIT v_max_transactions
    LOOP
      BEGIN
        -- Check if this transaction matches the rule
        IF public.check_transaction_matches_rule(v_transaction.id, NEW.id) THEN
          -- Apply the rule to the transaction
          v_result := public.apply_rule_to_transaction(
            v_transaction.id,
            NEW.id,
            true
          );

          v_processed_count := v_processed_count + 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_error_count := v_error_count + 1;
        RAISE WARNING 'Error applying rule % to transaction %: %',
          NEW.id, v_transaction.id, SQLERRM;

        IF v_error_count > 10 THEN
          RAISE WARNING 'Too many errors applying rule %, stopping auto-apply', NEW.id;
          EXIT;
        END IF;
      END;
    END LOOP;

    RAISE NOTICE 'Auto-applied rule % to % transactions (% errors)',
      NEW.id, v_processed_count, v_error_count;

  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Error in auto_apply_rule_on_change for rule %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

COMMENT ON TRIGGER trigger_auto_apply_rule_on_change ON public.transaction_rules IS
  'Auto-applies rules to matching transactions on UPDATE only (not INSERT). Processes up to 25 transactions per rule change to prevent timeouts.';