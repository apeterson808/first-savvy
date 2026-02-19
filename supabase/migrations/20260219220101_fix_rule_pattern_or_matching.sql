/*
  # Fix Rule Pattern OR Matching

  ## Problem
  When users create rules with multiple patterns separated by "|" (e.g., "CHEVRON|great scott|MAVERIK"),
  the check_transaction_matches_rule function treats this as a literal string in 'contains' mode,
  rather than checking each pattern separately with OR logic.

  ## Solution
  Update the check_transaction_matches_rule function to:
  1. Split pipe-separated patterns when not in regex mode
  2. Check each pattern individually with OR logic
  3. Maintain backward compatibility with single patterns

  ## Changes
  - Modified check_transaction_matches_rule function to handle pipe-separated patterns
*/

CREATE OR REPLACE FUNCTION public.check_transaction_matches_rule(p_transaction_id uuid, p_rule_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
v_transaction record;
v_rule record;
v_matches boolean := true;
v_description_lower text;
v_pattern_lower text;
v_patterns text[];
v_pattern text;
v_found boolean;
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

-- Check description pattern with pipe-separated OR logic
IF v_rule.match_description_pattern IS NOT NULL THEN
IF v_rule.match_case_sensitive THEN
v_description_lower := v_transaction.description;
v_pattern_lower := v_rule.match_description_pattern;
ELSE
v_description_lower := LOWER(v_transaction.description);
v_pattern_lower := LOWER(v_rule.match_description_pattern);
END IF;

-- Handle pipe-separated patterns (OR logic) for non-regex modes
IF v_rule.match_description_mode != 'regex' AND position('|' in v_pattern_lower) > 0 THEN
v_patterns := string_to_array(v_pattern_lower, '|');
v_found := false;
FOREACH v_pattern IN ARRAY v_patterns
LOOP
v_pattern := trim(v_pattern);
v_matches := CASE v_rule.match_description_mode
WHEN 'contains' THEN v_description_lower LIKE '%' || v_pattern || '%'
WHEN 'starts_with' THEN v_description_lower LIKE v_pattern || '%'
WHEN 'ends_with' THEN v_description_lower LIKE '%' || v_pattern
WHEN 'exact' THEN v_description_lower = v_pattern
ELSE false
END;
IF v_matches THEN
v_found := true;
EXIT;
END IF;
END LOOP;
IF NOT v_found THEN
RETURN false;
END IF;
ELSE
-- Single pattern matching
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
END IF;

-- Check original description (bank memo) pattern with pipe-separated OR logic
IF v_rule.match_original_description_pattern IS NOT NULL AND v_transaction.original_description IS NOT NULL THEN
IF v_rule.match_case_sensitive THEN
v_description_lower := v_transaction.original_description;
v_pattern_lower := v_rule.match_original_description_pattern;
ELSE
v_description_lower := LOWER(v_transaction.original_description);
v_pattern_lower := LOWER(v_rule.match_original_description_pattern);
END IF;

-- Handle pipe-separated patterns (OR logic) for non-regex modes
IF v_rule.match_description_mode != 'regex' AND position('|' in v_pattern_lower) > 0 THEN
v_patterns := string_to_array(v_pattern_lower, '|');
v_found := false;
FOREACH v_pattern IN ARRAY v_patterns
LOOP
v_pattern := trim(v_pattern);
v_matches := CASE v_rule.match_description_mode
WHEN 'contains' THEN v_description_lower LIKE '%' || v_pattern || '%'
WHEN 'starts_with' THEN v_description_lower LIKE v_pattern || '%'
WHEN 'ends_with' THEN v_description_lower LIKE '%' || v_pattern
WHEN 'exact' THEN v_description_lower = v_pattern
ELSE false
END;
IF v_matches THEN
v_found := true;
EXIT;
END IF;
END LOOP;
IF NOT v_found THEN
RETURN false;
END IF;
ELSE
-- Single pattern matching
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
$function$;
