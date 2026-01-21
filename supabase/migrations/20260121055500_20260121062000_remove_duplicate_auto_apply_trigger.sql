/*
  # Remove Duplicate Auto-Apply Trigger

  1. Problem
    - There are two triggers on transactions table for auto-applying rules
    - trigger_auto_apply_rule_to_transaction (old)
    - trigger_auto_apply_rules_on_insert (new)
    - Having duplicate triggers can cause issues

  2. Solution
    - Keep only the newer trigger_auto_apply_rules_on_insert
    - Drop the old trigger_auto_apply_rule_to_transaction

  3. Impact
    - Rules will apply correctly to new transactions
    - No duplicate processing
*/

-- Drop the old duplicate trigger
DROP TRIGGER IF EXISTS trigger_auto_apply_rule_to_transaction ON public.transactions;

-- Ensure the correct trigger exists
DROP TRIGGER IF EXISTS trigger_auto_apply_rules_on_insert ON public.transactions;

CREATE TRIGGER trigger_auto_apply_rules_on_insert
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_apply_rule_to_transaction();

COMMENT ON TRIGGER trigger_auto_apply_rules_on_insert ON public.transactions IS
  'Automatically applies matching enabled rules to newly inserted pending transactions';