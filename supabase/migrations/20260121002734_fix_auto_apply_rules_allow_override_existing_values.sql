/*
  # Fix Auto-Apply Rules - Allow Override of Existing Values

  1. Overview
    The auto_apply_rule_to_transaction trigger was skipping transactions that
    already had categories or contacts. Rules should be able to override these
    existing values.

  2. Changes
    - Remove the check for NEW.category_account_id IS NOT NULL
    - Only skip if transaction already has applied_rule_id or is not pending
    - This allows rules to override manually-set or AI-suggested categories

  3. Impact
    - Rules will now apply to ALL pending transactions
    - Rules can override existing categories and contacts
    - Only skip if a rule has already been applied (to avoid re-applying)
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
  -- Only skip if transaction is not pending or already has a rule applied
  -- Allow override of existing categories and contacts
  IF NEW.status != 'pending' OR NEW.applied_rule_id IS NOT NULL THEN
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
'Automatically applies the first matching enabled rule to newly inserted pending transactions. Rules can override existing categories and contacts. Only skips if transaction is not pending or already has a rule applied.';
