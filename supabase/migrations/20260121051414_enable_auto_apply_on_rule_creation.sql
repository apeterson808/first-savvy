/*
  # Enable Auto-Apply on Rule Creation

  1. Changes
    - Modify trigger to fire on both INSERT and UPDATE
    - Rules will automatically apply when created
    - Keep the 100 transaction limit to prevent timeouts
    - If you have more than 100 pending transactions, use "Apply Rules" button

  2. Security
    - Maintains SECURITY DEFINER for safe execution
    - Keeps error handling to prevent failures
*/

-- Drop and recreate the trigger to fire on both INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_auto_apply_rule_on_change ON public.transaction_rules;

CREATE TRIGGER trigger_auto_apply_rule_on_change
  AFTER INSERT OR UPDATE ON public.transaction_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_apply_rule_on_change();

-- Update the function to allow INSERT operations
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
  v_max_transactions integer := 100;
  v_error_count integer := 0;
BEGIN
  -- Only process if rule is enabled
  IF NEW.is_enabled = false THEN
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
  'Auto-applies rules to matching transactions on INSERT or UPDATE. Processes up to 100 transactions per rule change.';
