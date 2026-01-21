/*
  # Fix Rule Trigger for INSERT Operations

  1. Problem
    - auto_apply_rule_on_change() trigger fails on INSERT because it compares OLD values
    - OLD is NULL on INSERT, causing the comparison logic to fail or skip processing
    - Has artificial 25 transaction limit that doesn't match preview behavior
    - Preview shows all matches, but trigger only processes 25

  2. Solution
    - Check TG_OP to distinguish INSERT from UPDATE operations
    - Only compare OLD values on UPDATE
    - On INSERT, always process the rule (no OLD comparison)
    - Remove transaction limit so trigger processes ALL matches (like preview does)

  3. Expected Behavior
    - On INSERT (create rule): Apply to all matching pending transactions
    - On UPDATE (edit rule): Re-apply to all matching pending transactions
    - Match count in UI will reflect actual number of transactions affected
*/

CREATE OR REPLACE FUNCTION public.auto_apply_rule_on_change()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction RECORD;
  v_result jsonb;
  v_processed_count integer := 0;
  v_error_count integer := 0;
BEGIN
  -- Only process if rule is enabled
  IF NEW.is_enabled = false THEN
    RETURN NEW;
  END IF;

  -- On UPDATE, check if relevant fields actually changed
  -- On INSERT, always process (TG_OP will be 'INSERT')
  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_enabled = NEW.is_enabled
      AND OLD.match_description_pattern IS NOT DISTINCT FROM NEW.match_description_pattern
      AND OLD.match_original_description_pattern IS NOT DISTINCT FROM NEW.match_original_description_pattern
      AND OLD.match_bank_account_ids IS NOT DISTINCT FROM NEW.match_bank_account_ids
      AND OLD.match_money_direction IS NOT DISTINCT FROM NEW.match_money_direction
      AND OLD.match_conditions_logic IS NOT DISTINCT FROM NEW.match_conditions_logic
      AND OLD.match_amount_min IS NOT DISTINCT FROM NEW.match_amount_min
      AND OLD.match_amount_max IS NOT DISTINCT FROM NEW.match_amount_max
      AND OLD.match_amount_exact IS NOT DISTINCT FROM NEW.match_amount_exact
      AND OLD.action_set_category_id IS NOT DISTINCT FROM NEW.action_set_category_id
      AND OLD.action_set_contact_id IS NOT DISTINCT FROM NEW.action_set_contact_id
      AND OLD.action_set_description IS NOT DISTINCT FROM NEW.action_set_description
      AND OLD.action_add_note IS NOT DISTINCT FROM NEW.action_add_note
      AND OLD.auto_confirm_and_post IS NOT DISTINCT FROM NEW.auto_confirm_and_post THEN
      -- No relevant changes, skip processing
      RETURN NEW;
    END IF;
  END IF;

  -- Process all pending transactions that match this rule
  -- No limit - process ALL matches (same as preview behavior)
  BEGIN
    FOR v_transaction IN
      SELECT t.id
      FROM public.transactions t
      WHERE t.profile_id = NEW.profile_id
        AND t.status = 'pending'
        AND (t.applied_rule_id IS NULL OR t.applied_rule_id = NEW.id)
      ORDER BY t.date DESC
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

          IF (v_result->>'success')::boolean THEN
            v_processed_count := v_processed_count + 1;
          END IF;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        v_error_count := v_error_count + 1;
        RAISE WARNING 'Error applying rule % to transaction %: %',
          NEW.id, v_transaction.id, SQLERRM;

        -- Stop if too many errors (safety limit)
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

COMMENT ON FUNCTION public.auto_apply_rule_on_change() IS
  'Automatically applies a rule to all matching pending transactions when the rule is created or updated. Processes all matches without limit to match preview behavior.';
