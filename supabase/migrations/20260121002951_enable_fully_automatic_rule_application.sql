/*
  # Enable Fully Automatic Rule Application

  1. Overview
    Make rules fully automatic - no need to manually click "Apply Rules"
    
  2. Changes Made
    - Update trigger to fire on BOTH INSERT and UPDATE of transactions
    - When a rule is created/updated, automatically apply to ALL matching pending transactions
    - Remove restriction that transactions must have no category
    - Rules can override existing categories and contacts
    
  3. Behavior
    - New transactions get rules applied automatically
    - Updated transactions get rules re-evaluated
    - When you create/edit a rule, it automatically applies to all matches
    - Rules override existing values (unless already has applied_rule_id)
*/

-- 1. Make transaction trigger work on both INSERT and UPDATE
DROP TRIGGER IF EXISTS trigger_auto_apply_rule_to_transaction ON transactions;
CREATE TRIGGER trigger_auto_apply_rule_to_transaction
  AFTER INSERT OR UPDATE ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION auto_apply_rule_to_transaction();

-- 2. Update the rule change trigger to apply to all matching transactions (not just uncategorized)
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

  -- Find all matching pending transactions without an applied rule
  -- (Allow override of existing categories/contacts)
  FOR v_transaction IN 
    SELECT id FROM transactions
    WHERE profile_id = NEW.profile_id
      AND status = 'pending'
      AND applied_rule_id IS NULL
    ORDER BY date DESC
  LOOP
    -- Check if this transaction matches the rule
    IF public.check_transaction_matches_rule(v_transaction.id, NEW.id) THEN
      -- Apply the rule
      v_result := public.apply_rule_to_transaction(v_transaction.id, NEW.id, true);
      
      IF (v_result->>'success')::boolean THEN
        v_match_count := v_match_count + 1;
      END IF;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Make sure the trigger exists on transaction_rules
DROP TRIGGER IF EXISTS trigger_auto_apply_rule_on_change ON transaction_rules;
CREATE TRIGGER trigger_auto_apply_rule_on_change
  AFTER INSERT OR UPDATE ON transaction_rules
  FOR EACH ROW
  EXECUTE FUNCTION auto_apply_rule_on_change();

COMMENT ON FUNCTION auto_apply_rule_on_change() IS 
'Automatically applies a rule to all matching pending transactions when the rule is created or updated. Can override existing categories and contacts.';

COMMENT ON TRIGGER trigger_auto_apply_rule_to_transaction ON transactions IS
'Automatically applies the first matching enabled rule when a transaction is inserted or updated. Only runs for pending transactions without an applied_rule_id.';
