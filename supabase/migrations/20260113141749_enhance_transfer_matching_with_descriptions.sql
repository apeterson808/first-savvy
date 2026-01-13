/*
  # Enhance Transfer Matching with Transaction Descriptions

  Adds description-based matching for transfers to improve accuracy.

  1. Helper Functions
    - `extract_transfer_reference` - Extracts reference numbers like #120510921#
    - `extract_account_reference` - Extracts account numbers like *****1812
    - `has_transfer_keywords` - Checks for transfer-related keywords

  2. Updates
    - Enhanced `calculate_transfer_confidence` to include description signals
    - Modified `auto_detect_transfers` to prioritize reference number matches
    - Adds +25 points for matching reference numbers
    - Adds +10 points for transfer keywords in both descriptions
    - Adds +5 points for matching account references

  3. Benefits
    - Higher accuracy (95-100% confidence for reference matches)
    - Faster matching on unique reference numbers
    - Better handling of multi-day transfers
*/

-- Function to extract transfer reference number from description
CREATE OR REPLACE FUNCTION extract_transfer_reference(p_description text)
RETURNS text AS $$
BEGIN
  -- Extract patterns like #120510921# or #1234567890#
  RETURN (regexp_match(p_description, '#(\d+)#'))[1];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to extract account reference from description
CREATE OR REPLACE FUNCTION extract_account_reference(p_description text)
RETURNS text AS $$
BEGIN
  -- Extract patterns like *****1812 or ****9817
  RETURN (regexp_match(p_description, '\*+(\d{4})'))[1];
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if description contains transfer keywords
CREATE OR REPLACE FUNCTION has_transfer_keywords(p_description text)
RETURNS boolean AS $$
BEGIN
  IF p_description IS NULL THEN
    RETURN false;
  END IF;

  RETURN p_description ~* '(transfer|xfer|trnsfr|move|from|to)';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Drop the old function first
DROP FUNCTION IF EXISTS calculate_transfer_confidence(numeric, numeric, uuid, uuid, uuid);

-- Enhanced confidence calculation with description signals
CREATE OR REPLACE FUNCTION calculate_transfer_confidence(
  p_amount numeric,
  p_date_diff_days numeric,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_profile_id uuid,
  p_desc1 text DEFAULT NULL,
  p_desc2 text DEFAULT NULL
) RETURNS numeric AS $$
DECLARE
  v_base_score numeric := 70;
  v_pattern_bonus numeric := 0;
  v_date_penalty numeric := 0;
  v_amount_bonus numeric := 0;
  v_description_bonus numeric := 0;
  v_pattern_record RECORD;
  v_ref1 text;
  v_ref2 text;
  v_acc_ref1 text;
  v_acc_ref2 text;
BEGIN
  -- Base score starts at 70 for any matching transfer candidate

  -- Description-based scoring (highest priority)
  IF p_desc1 IS NOT NULL AND p_desc2 IS NOT NULL THEN
    -- Extract reference numbers
    v_ref1 := extract_transfer_reference(p_desc1);
    v_ref2 := extract_transfer_reference(p_desc2);

    -- Matching reference number is a very strong signal
    IF v_ref1 IS NOT NULL AND v_ref2 IS NOT NULL AND v_ref1 = v_ref2 THEN
      v_description_bonus := v_description_bonus + 25;
    END IF;

    -- Both descriptions contain transfer keywords
    IF has_transfer_keywords(p_desc1) AND has_transfer_keywords(p_desc2) THEN
      v_description_bonus := v_description_bonus + 10;
    END IF;

    -- Extract and match account references
    v_acc_ref1 := extract_account_reference(p_desc1);
    v_acc_ref2 := extract_account_reference(p_desc2);

    IF v_acc_ref1 IS NOT NULL AND v_acc_ref2 IS NOT NULL AND v_acc_ref1 = v_acc_ref2 THEN
      v_description_bonus := v_description_bonus + 5;
    END IF;
  END IF;

  -- Check if there's a historical pattern between these accounts
  SELECT * INTO v_pattern_record
  FROM transfer_patterns
  WHERE profile_id = p_profile_id
    AND from_account_id = p_from_account_id
    AND to_account_id = p_to_account_id
  LIMIT 1;

  IF FOUND THEN
    -- Add bonus based on acceptance rate of this pattern
    v_pattern_bonus := (v_pattern_record.acceptance_rate / 100) * 20;

    -- Add bonus if this amount is common for this pattern
    IF p_amount = ANY(v_pattern_record.common_amounts) THEN
      v_amount_bonus := 10;
    END IF;
  END IF;

  -- Penalize based on date difference (same day = 0 penalty, 7 days = -15)
  v_date_penalty := (p_date_diff_days / 7) * 15;

  -- Calculate final score (can exceed 100, will be capped)
  RETURN LEAST(100, GREATEST(0, v_base_score + v_description_bonus + v_pattern_bonus + v_amount_bonus - v_date_penalty));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Enhanced auto-detect function with description matching
CREATE OR REPLACE FUNCTION auto_detect_transfers(
  p_profile_id uuid,
  p_transaction_ids uuid[] DEFAULT NULL
) RETURNS TABLE (
  transaction_id uuid,
  matched_transaction_id uuid,
  confidence numeric,
  auto_matched boolean
) AS $$
DECLARE
  v_transaction RECORD;
  v_potential_match RECORD;
  v_confidence numeric;
  v_transfer_pair_id uuid;
  v_pattern_id uuid;
  v_ref_number text;
  v_found_match boolean;
BEGIN
  -- Loop through transactions to check
  FOR v_transaction IN
    SELECT t.*
    FROM transactions t
    WHERE t.profile_id = p_profile_id
      AND t.status = 'pending'
      AND t.transfer_pair_id IS NULL
      AND t.type != 'transfer'
      AND (p_transaction_ids IS NULL OR t.id = ANY(p_transaction_ids))
    ORDER BY t.transaction_date DESC
  LOOP
    v_found_match := false;

    -- PRIORITY 1: Try to match on reference number first (fastest and most accurate)
    v_ref_number := extract_transfer_reference(COALESCE(v_transaction.description, v_transaction.original_description));

    IF v_ref_number IS NOT NULL THEN
      FOR v_potential_match IN
        SELECT t2.*
        FROM transactions t2
        WHERE t2.profile_id = p_profile_id
          AND t2.id != v_transaction.id
          AND t2.status = 'pending'
          AND t2.transfer_pair_id IS NULL
          AND t2.account_id != v_transaction.account_id
          AND t2.amount = -v_transaction.amount
          -- Check if reference number matches
          AND extract_transfer_reference(COALESCE(t2.description, t2.original_description)) = v_ref_number
          -- Within 30 days for reference number matches (more lenient since we have strong signal)
          AND ABS(EXTRACT(EPOCH FROM (t2.transaction_date - v_transaction.transaction_date)) / 86400) <= 30
        ORDER BY ABS(EXTRACT(EPOCH FROM (t2.transaction_date - v_transaction.transaction_date)))
        LIMIT 1
      LOOP
        v_found_match := true;

        -- Calculate confidence score with descriptions
        v_confidence := calculate_transfer_confidence(
          ABS(v_transaction.amount),
          ABS(EXTRACT(EPOCH FROM (v_potential_match.transaction_date - v_transaction.transaction_date)) / 86400),
          CASE WHEN v_transaction.amount < 0 THEN v_transaction.account_id ELSE v_potential_match.account_id END,
          CASE WHEN v_transaction.amount > 0 THEN v_transaction.account_id ELSE v_potential_match.account_id END,
          p_profile_id,
          COALESCE(v_transaction.description, v_transaction.original_description),
          COALESCE(v_potential_match.description, v_potential_match.original_description)
        );

        -- If confidence is 95% or higher, automatically match
        IF v_confidence >= 95 THEN
          v_transfer_pair_id := gen_random_uuid();

          UPDATE transactions
          SET
            transfer_pair_id = v_transfer_pair_id,
            type = 'transfer',
            transfer_match_confidence = v_confidence,
            transfer_auto_detected = true,
            transfer_reviewed = false
          WHERE id IN (v_transaction.id, v_potential_match.id);

          -- Update or create transfer pattern
          INSERT INTO transfer_patterns (
            profile_id,
            from_account_id,
            to_account_id,
            total_transfers,
            total_auto_detected,
            common_amounts,
            average_amount,
            first_transfer_date,
            last_transfer_date
          )
          VALUES (
            p_profile_id,
            CASE WHEN v_transaction.amount < 0 THEN v_transaction.account_id ELSE v_potential_match.account_id END,
            CASE WHEN v_transaction.amount > 0 THEN v_transaction.account_id ELSE v_potential_match.account_id END,
            1,
            1,
            ARRAY[ABS(v_transaction.amount)],
            ABS(v_transaction.amount),
            LEAST(v_transaction.transaction_date, v_potential_match.transaction_date),
            GREATEST(v_transaction.transaction_date, v_potential_match.transaction_date)
          )
          ON CONFLICT (profile_id, from_account_id, to_account_id)
          DO UPDATE SET
            total_transfers = transfer_patterns.total_transfers + 1,
            total_auto_detected = transfer_patterns.total_auto_detected + 1,
            common_amounts = array_append(transfer_patterns.common_amounts, ABS(v_transaction.amount)),
            average_amount = (transfer_patterns.average_amount * transfer_patterns.total_transfers + ABS(v_transaction.amount)) / (transfer_patterns.total_transfers + 1),
            last_transfer_date = GREATEST(v_transaction.transaction_date, v_potential_match.transaction_date),
            last_updated = now()
          RETURNING id INTO v_pattern_id;

          UPDATE transactions
          SET transfer_pattern_id = v_pattern_id
          WHERE id IN (v_transaction.id, v_potential_match.id);

          RETURN QUERY SELECT v_transaction.id, v_potential_match.id, v_confidence, true;
        ELSE
          RETURN QUERY SELECT v_transaction.id, v_potential_match.id, v_confidence, false;
        END IF;
      END LOOP;
    END IF;

    -- PRIORITY 2: If no reference number match, fall back to traditional matching
    IF NOT v_found_match THEN
      FOR v_potential_match IN
        SELECT t2.*
        FROM transactions t2
        WHERE t2.profile_id = p_profile_id
          AND t2.id != v_transaction.id
          AND t2.status = 'pending'
          AND t2.transfer_pair_id IS NULL
          AND t2.account_id != v_transaction.account_id
          AND t2.amount = -v_transaction.amount
          -- Within 7 days for non-reference matches
          AND ABS(EXTRACT(EPOCH FROM (t2.transaction_date - v_transaction.transaction_date)) / 86400) <= 7
        ORDER BY ABS(EXTRACT(EPOCH FROM (t2.transaction_date - v_transaction.transaction_date)))
        LIMIT 1
      LOOP
        -- Calculate confidence score with descriptions
        v_confidence := calculate_transfer_confidence(
          ABS(v_transaction.amount),
          ABS(EXTRACT(EPOCH FROM (v_potential_match.transaction_date - v_transaction.transaction_date)) / 86400),
          CASE WHEN v_transaction.amount < 0 THEN v_transaction.account_id ELSE v_potential_match.account_id END,
          CASE WHEN v_transaction.amount > 0 THEN v_transaction.account_id ELSE v_potential_match.account_id END,
          p_profile_id,
          COALESCE(v_transaction.description, v_transaction.original_description),
          COALESCE(v_potential_match.description, v_potential_match.original_description)
        );

        IF v_confidence >= 95 THEN
          v_transfer_pair_id := gen_random_uuid();

          UPDATE transactions
          SET
            transfer_pair_id = v_transfer_pair_id,
            type = 'transfer',
            transfer_match_confidence = v_confidence,
            transfer_auto_detected = true,
            transfer_reviewed = false
          WHERE id IN (v_transaction.id, v_potential_match.id);

          INSERT INTO transfer_patterns (
            profile_id,
            from_account_id,
            to_account_id,
            total_transfers,
            total_auto_detected,
            common_amounts,
            average_amount,
            first_transfer_date,
            last_transfer_date
          )
          VALUES (
            p_profile_id,
            CASE WHEN v_transaction.amount < 0 THEN v_transaction.account_id ELSE v_potential_match.account_id END,
            CASE WHEN v_transaction.amount > 0 THEN v_transaction.account_id ELSE v_potential_match.account_id END,
            1,
            1,
            ARRAY[ABS(v_transaction.amount)],
            ABS(v_transaction.amount),
            LEAST(v_transaction.transaction_date, v_potential_match.transaction_date),
            GREATEST(v_transaction.transaction_date, v_potential_match.transaction_date)
          )
          ON CONFLICT (profile_id, from_account_id, to_account_id)
          DO UPDATE SET
            total_transfers = transfer_patterns.total_transfers + 1,
            total_auto_detected = transfer_patterns.total_auto_detected + 1,
            common_amounts = array_append(transfer_patterns.common_amounts, ABS(v_transaction.amount)),
            average_amount = (transfer_patterns.average_amount * transfer_patterns.total_transfers + ABS(v_transaction.amount)) / (transfer_patterns.total_transfers + 1),
            last_transfer_date = GREATEST(v_transaction.transaction_date, v_potential_match.transaction_date),
            last_updated = now()
          RETURNING id INTO v_pattern_id;

          UPDATE transactions
          SET transfer_pattern_id = v_pattern_id
          WHERE id IN (v_transaction.id, v_potential_match.id);

          RETURN QUERY SELECT v_transaction.id, v_potential_match.id, v_confidence, true;
        ELSE
          RETURN QUERY SELECT v_transaction.id, v_potential_match.id, v_confidence, false;
        END IF;
      END LOOP;
    END IF;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION extract_transfer_reference TO authenticated;
GRANT EXECUTE ON FUNCTION extract_account_reference TO authenticated;
GRANT EXECUTE ON FUNCTION has_transfer_keywords TO authenticated;
GRANT EXECUTE ON FUNCTION calculate_transfer_confidence TO authenticated;
GRANT EXECUTE ON FUNCTION auto_detect_transfers TO authenticated;

-- Add comments
COMMENT ON FUNCTION extract_transfer_reference IS 'Extracts reference numbers from transaction descriptions (e.g., #120510921#)';
COMMENT ON FUNCTION extract_account_reference IS 'Extracts account references from transaction descriptions (e.g., *****1812)';
COMMENT ON FUNCTION has_transfer_keywords IS 'Checks if description contains transfer-related keywords';
COMMENT ON FUNCTION calculate_transfer_confidence IS 'Enhanced confidence calculation including description-based signals for transfer matching';
COMMENT ON FUNCTION auto_detect_transfers IS 'Enhanced transfer detection that prioritizes reference number matches and uses description signals';
