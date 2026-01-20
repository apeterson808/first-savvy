/*
  # Fix Auto-Apply Rule Trigger Column Name

  1. Overview
    Fixes the auto_apply_rule_on_change() trigger function to use correct column name 'status' instead of 'transaction_status'

  2. Changes
    - Update auto_apply_rule_on_change() function to reference 'status' instead of 'transaction_status'

  3. Impact
    - Allows rules to be created without database errors
    - Enables automatic rule application on creation
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
      AND chart_account_id IS NULL
      AND applied_rule_id IS NULL
    ORDER BY transaction_date DESC
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