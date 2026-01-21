/*
  # Fix Auto-Apply on Transaction Insert to Use Current Schema

  1. Problem
    - The auto_apply_rule_to_transaction trigger uses old column names
    - References columns like transaction_status, chart_account_id, is_active, condition_*
    - These columns don't exist in the current schema
    - Rules don't apply to transactions on insert

  2. Solution
    - Rewrite the trigger to use current schema
    - Use check_transaction_matches_rule() function for matching
    - Use apply_rule_to_transaction() function for applying
    - Process only pending transactions without applied_rule_id

  3. Impact
    - Rules will now properly apply to new transactions
    - Uses the existing tested functions
    - Consistent behavior with manual rule application
*/

-- Rewrite the auto-apply function to use current schema and existing functions
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
  -- Only process pending transactions without an applied rule
  IF NEW.status != 'pending' OR NEW.applied_rule_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Find first matching enabled rule (ordered by created_at for consistency)
  FOR v_rule IN 
    SELECT * FROM transaction_rules
    WHERE profile_id = NEW.profile_id
      AND is_enabled = true
    ORDER BY created_at ASC
  LOOP
    -- Check if this transaction matches the rule using our existing function
    IF public.check_transaction_matches_rule(NEW.id, v_rule.id) THEN
      -- Apply the rule using our existing function
      v_result := public.apply_rule_to_transaction(
        NEW.id,
        v_rule.id,
        true  -- update the transaction
      );
      
      -- Exit after applying first matching rule
      EXIT;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION auto_apply_rule_to_transaction() IS 
  'Automatically applies the first matching enabled rule to newly inserted pending transactions';
