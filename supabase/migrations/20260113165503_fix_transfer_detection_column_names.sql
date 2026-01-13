/*
  # Fix Transfer Detection Functions - Column Name Standardization

  This migration fixes a critical bug in the transfer auto-detection system caused by
  a column naming mismatch between the database schema and SQL functions.

  ## Background
  - On Dec 31, 2025: transactions.account_id was renamed to transactions.bank_account_id
  - On Jan 13, 2026: Transfer detection functions were added using the OLD column name
  - Result: Transfer auto-detection fails because it references non-existent column

  ## Changes
  Replace all occurrences of:
    - `t.account_id` → `t.bank_account_id`
    - `t2.account_id` → `t2.bank_account_id`
    - `v_transaction.account_id` → `v_transaction.bank_account_id`
    - `v_potential_match.account_id` → `v_potential_match.bank_account_id`
    - `v_txn1.account_id` → `v_txn1.bank_account_id`
    - `v_txn2.account_id` → `v_txn2.bank_account_id`

  ## Functions Updated
  1. calculate_transfer_confidence - No change (doesn't reference transactions table)
  2. auto_detect_transfers - Fixed bank_account_id references throughout
  3. link_transfer_pair - Fixed bank_account_id validation
  4. unlink_transfer_pair - No change (doesn't reference account_id)

  ## Impact
  - Fixes transfer auto-detection in ICCU simulator and other bank imports
  - Maintains all existing functionality and confidence scoring
  - No data migration required - only function definitions updated
*/

-- Enhanced confidence calculation with description signals (no changes needed - doesn't reference transactions)
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

-- Enhanced auto-detect function with FIXED column names: account_id → bank_account_id
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
          AND t2.bank_account_id != v_transaction.bank_account_id
          AND t2.amount = -v_transaction.amount
          AND extract_transfer_reference(COALESCE(t2.description, t2.original_description)) = v_ref_number
          AND ABS(EXTRACT(EPOCH FROM (t2.transaction_date - v_transaction.transaction_date)) / 86400) <= 30
        ORDER BY ABS(EXTRACT(EPOCH FROM (t2.transaction_date - v_transaction.transaction_date)))
        LIMIT 1
      LOOP
        v_found_match := true;

        v_confidence := calculate_transfer_confidence(
          ABS(v_transaction.amount),
          ABS(EXTRACT(EPOCH FROM (v_potential_match.transaction_date - v_transaction.transaction_date)) / 86400),
          CASE WHEN v_transaction.amount < 0 THEN v_transaction.bank_account_id ELSE v_potential_match.bank_account_id END,
          CASE WHEN v_transaction.amount > 0 THEN v_transaction.bank_account_id ELSE v_potential_match.bank_account_id END,
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
            CASE WHEN v_transaction.amount < 0 THEN v_transaction.bank_account_id ELSE v_potential_match.bank_account_id END,
            CASE WHEN v_transaction.amount > 0 THEN v_transaction.bank_account_id ELSE v_potential_match.bank_account_id END,
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

    IF NOT v_found_match THEN
      FOR v_potential_match IN
        SELECT t2.*
        FROM transactions t2
        WHERE t2.profile_id = p_profile_id
          AND t2.id != v_transaction.id
          AND t2.status = 'pending'
          AND t2.transfer_pair_id IS NULL
          AND t2.bank_account_id != v_transaction.bank_account_id
          AND t2.amount = -v_transaction.amount
          AND ABS(EXTRACT(EPOCH FROM (t2.transaction_date - v_transaction.transaction_date)) / 86400) <= 7
        ORDER BY ABS(EXTRACT(EPOCH FROM (t2.transaction_date - v_transaction.transaction_date)))
        LIMIT 1
      LOOP
        v_confidence := calculate_transfer_confidence(
          ABS(v_transaction.amount),
          ABS(EXTRACT(EPOCH FROM (v_potential_match.transaction_date - v_transaction.transaction_date)) / 86400),
          CASE WHEN v_transaction.amount < 0 THEN v_transaction.bank_account_id ELSE v_potential_match.bank_account_id END,
          CASE WHEN v_transaction.amount > 0 THEN v_transaction.bank_account_id ELSE v_potential_match.bank_account_id END,
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
            CASE WHEN v_transaction.amount < 0 THEN v_transaction.bank_account_id ELSE v_potential_match.bank_account_id END,
            CASE WHEN v_transaction.amount > 0 THEN v_transaction.bank_account_id ELSE v_potential_match.bank_account_id END,
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

-- Function to link two transactions as a transfer pair with FIXED column name
CREATE OR REPLACE FUNCTION link_transfer_pair(
  p_transaction_id_1 uuid,
  p_transaction_id_2 uuid,
  p_profile_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_txn1 record;
  v_txn2 record;
  v_new_pair_id uuid;
BEGIN
  SELECT * INTO v_txn1
  FROM transactions
  WHERE id = p_transaction_id_1 AND profile_id = p_profile_id;

  SELECT * INTO v_txn2
  FROM transactions
  WHERE id = p_transaction_id_2 AND profile_id = p_profile_id;

  IF v_txn1 IS NULL OR v_txn2 IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'One or both transactions not found');
  END IF;

  IF v_txn1.bank_account_id = v_txn2.bank_account_id THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot link transactions from the same account');
  END IF;

  IF v_txn1.transfer_pair_id IS NOT NULL OR v_txn2.transfer_pair_id IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'One or both transactions are already paired');
  END IF;

  IF ABS(v_txn1.amount) != ABS(v_txn2.amount) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction amounts must be equal');
  END IF;

  IF SIGN(v_txn1.amount) = SIGN(v_txn2.amount) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction amounts must have opposite signs');
  END IF;

  v_new_pair_id := gen_random_uuid();

  UPDATE transactions
  SET
    transfer_pair_id = v_new_pair_id,
    type = 'transfer',
    updated_at = now()
  WHERE id IN (p_transaction_id_1, p_transaction_id_2)
    AND profile_id = p_profile_id;

  RETURN jsonb_build_object(
    'success', true,
    'transfer_pair_id', v_new_pair_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION calculate_transfer_confidence TO authenticated;
GRANT EXECUTE ON FUNCTION auto_detect_transfers TO authenticated;
GRANT EXECUTE ON FUNCTION link_transfer_pair TO authenticated;

COMMENT ON FUNCTION calculate_transfer_confidence IS 'Enhanced confidence calculation including description-based signals for transfer matching';
COMMENT ON FUNCTION auto_detect_transfers IS 'Enhanced transfer detection that prioritizes reference number matches and uses description signals. FIXED: Uses bank_account_id instead of account_id.';
COMMENT ON FUNCTION link_transfer_pair IS 'Links two transactions as a transfer pair with validation. FIXED: Uses bank_account_id instead of account_id.';