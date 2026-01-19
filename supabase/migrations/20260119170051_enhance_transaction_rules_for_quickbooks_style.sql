/*
  # Enhance Transaction Rules for QuickBooks-Style Quick Create

  ## Overview
  Adds new fields to support QuickBooks-inspired rule creation with:
  - Multiple account selection
  - Money direction filtering (in/out/both)
  - Bank memo (original description) searching
  - Bulk description changes
  - Auto-confirm and post capability
  - Rule name uniqueness enforcement

  ## Changes
  1. Add new matching fields for enhanced condition support
  2. Add new action fields for bulk description changes
  3. Add auto-confirm toggle field
  4. Add unique constraint on rule names per profile
  5. Update functions to handle new fields

  ## Security
  - Maintains existing RLS policies
  - All changes are backwards compatible
*/

-- ============================================================================
-- Add New Columns to transaction_rules
-- ============================================================================

-- Matching enhancements
ALTER TABLE public.transaction_rules
ADD COLUMN IF NOT EXISTS match_bank_account_ids uuid[] DEFAULT NULL;

ALTER TABLE public.transaction_rules
ADD COLUMN IF NOT EXISTS match_money_direction text DEFAULT 'both'
  CHECK (match_money_direction IN ('money_in', 'money_out', 'both'));

ALTER TABLE public.transaction_rules
ADD COLUMN IF NOT EXISTS match_original_description_pattern text DEFAULT NULL;

ALTER TABLE public.transaction_rules
ADD COLUMN IF NOT EXISTS match_conditions_logic text DEFAULT 'all'
  CHECK (match_conditions_logic IN ('any', 'all'));

-- Action enhancements
ALTER TABLE public.transaction_rules
ADD COLUMN IF NOT EXISTS action_set_description text DEFAULT NULL;

-- Automation
ALTER TABLE public.transaction_rules
ADD COLUMN IF NOT EXISTS auto_confirm_and_post boolean DEFAULT false;

-- ============================================================================
-- Add Unique Constraint on Rule Names per Profile
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS idx_transaction_rules_profile_name_unique
  ON public.transaction_rules(profile_id, LOWER(name));

-- ============================================================================
-- Update check_transaction_matches_rule Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_transaction_matches_rule(
  p_transaction_id uuid,
  p_rule_id uuid
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction record;
  v_rule record;
  v_matches boolean := true;
  v_description_lower text;
  v_pattern_lower text;
BEGIN
  -- Get transaction
  SELECT * INTO v_transaction FROM transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Get rule
  SELECT * INTO v_rule FROM transaction_rules WHERE id = p_rule_id AND is_enabled = true;
  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Check profile match
  IF v_transaction.profile_id != v_rule.profile_id THEN
    RETURN false;
  END IF;

  -- Check money direction
  IF v_rule.match_money_direction IS NOT NULL AND v_rule.match_money_direction != 'both' THEN
    IF v_rule.match_money_direction = 'money_out' AND v_transaction.type NOT IN ('expense', 'transfer', 'credit_card_payment') THEN
      RETURN false;
    END IF;
    IF v_rule.match_money_direction = 'money_in' AND v_transaction.type != 'income' THEN
      RETURN false;
    END IF;
  END IF;

  -- Check bank accounts (multiple selection support)
  IF v_rule.match_bank_account_ids IS NOT NULL AND array_length(v_rule.match_bank_account_ids, 1) > 0 THEN
    IF NOT (v_transaction.bank_account_id = ANY(v_rule.match_bank_account_ids)) THEN
      RETURN false;
    END IF;
  END IF;

  -- Check description pattern
  IF v_rule.match_description_pattern IS NOT NULL THEN
    IF v_rule.match_case_sensitive THEN
      v_description_lower := v_transaction.description;
      v_pattern_lower := v_rule.match_description_pattern;
    ELSE
      v_description_lower := LOWER(v_transaction.description);
      v_pattern_lower := LOWER(v_rule.match_description_pattern);
    END IF;

    v_matches := CASE v_rule.match_description_mode
      WHEN 'contains' THEN v_description_lower LIKE '%' || v_pattern_lower || '%'
      WHEN 'starts_with' THEN v_description_lower LIKE v_pattern_lower || '%'
      WHEN 'ends_with' THEN v_description_lower LIKE '%' || v_pattern_lower
      WHEN 'exact' THEN v_description_lower = v_pattern_lower
      WHEN 'regex' THEN v_description_lower ~ v_pattern_lower
      ELSE false
    END;

    IF NOT v_matches THEN
      RETURN false;
    END IF;
  END IF;

  -- Check original description (bank memo) pattern
  IF v_rule.match_original_description_pattern IS NOT NULL AND v_transaction.original_description IS NOT NULL THEN
    IF v_rule.match_case_sensitive THEN
      v_description_lower := v_transaction.original_description;
      v_pattern_lower := v_rule.match_original_description_pattern;
    ELSE
      v_description_lower := LOWER(v_transaction.original_description);
      v_pattern_lower := LOWER(v_rule.match_original_description_pattern);
    END IF;

    v_matches := CASE v_rule.match_description_mode
      WHEN 'contains' THEN v_description_lower LIKE '%' || v_pattern_lower || '%'
      WHEN 'starts_with' THEN v_description_lower LIKE v_pattern_lower || '%'
      WHEN 'ends_with' THEN v_description_lower LIKE '%' || v_pattern_lower
      WHEN 'exact' THEN v_description_lower = v_pattern_lower
      WHEN 'regex' THEN v_description_lower ~ v_pattern_lower
      ELSE false
    END;

    IF NOT v_matches THEN
      RETURN false;
    END IF;
  END IF;

  -- Check amount conditions
  IF v_rule.match_amount_exact IS NOT NULL THEN
    IF ABS(v_transaction.amount) != v_rule.match_amount_exact THEN
      RETURN false;
    END IF;
  ELSE
    IF v_rule.match_amount_min IS NOT NULL AND ABS(v_transaction.amount) < v_rule.match_amount_min THEN
      RETURN false;
    END IF;
    IF v_rule.match_amount_max IS NOT NULL AND ABS(v_transaction.amount) > v_rule.match_amount_max THEN
      RETURN false;
    END IF;
  END IF;

  -- Check transaction type
  IF v_rule.match_transaction_type IS NOT NULL AND v_transaction.type != v_rule.match_transaction_type THEN
    RETURN false;
  END IF;

  -- Check contact
  IF v_rule.match_contact_id IS NOT NULL AND v_transaction.contact_id != v_rule.match_contact_id THEN
    RETURN false;
  END IF;

  -- Check date range
  IF v_rule.match_date_from IS NOT NULL AND v_transaction.date < v_rule.match_date_from THEN
    RETURN false;
  END IF;
  IF v_rule.match_date_to IS NOT NULL AND v_transaction.date > v_rule.match_date_to THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;

-- ============================================================================
-- Update apply_rule_to_transaction Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_rule_to_transaction(
  p_transaction_id uuid,
  p_rule_id uuid,
  p_update_transaction boolean DEFAULT true
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_rule record;
  v_changes jsonb := '{}';
  v_update_data jsonb := '{}';
BEGIN
  -- Get rule
  SELECT * INTO v_rule FROM transaction_rules WHERE id = p_rule_id AND is_enabled = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rule not found or disabled');
  END IF;

  -- Check if rule matches
  IF NOT public.check_transaction_matches_rule(p_transaction_id, p_rule_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction does not match rule conditions');
  END IF;

  -- Build changes object and apply if requested
  IF v_rule.action_set_category_id IS NOT NULL THEN
    v_changes := jsonb_set(v_changes, '{category_account_id}', to_jsonb(v_rule.action_set_category_id::text));
    IF p_update_transaction THEN
      UPDATE transactions
      SET category_account_id = v_rule.action_set_category_id
      WHERE id = p_transaction_id;
    END IF;
  END IF;

  IF v_rule.action_set_contact_id IS NOT NULL THEN
    v_changes := jsonb_set(v_changes, '{contact_id}', to_jsonb(v_rule.action_set_contact_id::text));
    IF p_update_transaction THEN
      UPDATE transactions
      SET contact_id = v_rule.action_set_contact_id
      WHERE id = p_transaction_id;
    END IF;
  END IF;

  IF v_rule.action_set_description IS NOT NULL THEN
    v_changes := jsonb_set(v_changes, '{description}', to_jsonb(v_rule.action_set_description));
    IF p_update_transaction THEN
      UPDATE transactions
      SET description = v_rule.action_set_description
      WHERE id = p_transaction_id;
    END IF;
  END IF;

  IF v_rule.action_add_note IS NOT NULL THEN
    v_changes := jsonb_set(v_changes, '{note}', to_jsonb(v_rule.action_add_note));
    IF p_update_transaction THEN
      UPDATE transactions
      SET notes = COALESCE(notes || E'\n', '') || v_rule.action_add_note
      WHERE id = p_transaction_id;
    END IF;
  END IF;

  -- Auto-confirm and post if enabled
  IF v_rule.auto_confirm_and_post AND p_update_transaction THEN
    v_changes := jsonb_set(v_changes, '{status}', to_jsonb('posted'));
    UPDATE transactions
    SET status = 'posted'
    WHERE id = p_transaction_id;
  END IF;

  -- Update rule statistics
  UPDATE transaction_rules
  SET
    times_matched = times_matched + 1,
    last_matched_at = now()
  WHERE id = p_rule_id;

  RETURN jsonb_build_object(
    'success', true,
    'changes', v_changes,
    'rule_name', v_rule.name
  );
END;
$$;

-- ============================================================================
-- Add Comments
-- ============================================================================

COMMENT ON COLUMN public.transaction_rules.match_bank_account_ids IS
  'Array of bank account IDs to match against. NULL or empty array means match all accounts.';

COMMENT ON COLUMN public.transaction_rules.match_money_direction IS
  'Filter by money direction: money_in (income), money_out (expense/payment), or both';

COMMENT ON COLUMN public.transaction_rules.match_original_description_pattern IS
  'Pattern to match against original_description (bank memo) field';

COMMENT ON COLUMN public.transaction_rules.match_conditions_logic IS
  'How to combine multiple conditions: any (OR logic) or all (AND logic)';

COMMENT ON COLUMN public.transaction_rules.action_set_description IS
  'New description to set on matching transactions (replaces current description, preserves original_description)';

COMMENT ON COLUMN public.transaction_rules.auto_confirm_and_post IS
  'When true, automatically sets matching transactions to posted status';