/*
  # Fix Auto-Apply Rule Trigger - Correct Column Names

  1. Overview
    Fixes the auto_apply_rule_on_change() trigger to use correct column names:
    - 'category_account_id' instead of 'chart_account_id'
    - 'date' instead of 'transaction_date'

  2. Changes
    - Update trigger function to reference correct transaction table columns

  3. Impact
    - Rules can now be created without triggering database errors
    - Auto-application of rules on creation will work correctly
*/

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
  IF NOT NEW.is_enabled THEN
    RETURN NEW;
  END IF;

  FOR v_transaction IN
    SELECT id
    FROM transactions
    WHERE profile_id = NEW.profile_id
      AND status = 'pending'
      AND category_account_id IS NULL
      AND applied_rule_id IS NULL
    ORDER BY date DESC
  LOOP
    IF public.check_transaction_matches_rule(v_transaction.id, NEW.id) THEN
      v_result := public.apply_rule_to_transaction(v_transaction.id, NEW.id, true);

      IF (v_result->>'success')::boolean THEN
        v_match_count := v_match_count + 1;
      END IF;
    END IF;
  END LOOP;

  IF v_match_count > 0 THEN
    UPDATE transaction_rules SET
      last_matched_at = NOW()
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;