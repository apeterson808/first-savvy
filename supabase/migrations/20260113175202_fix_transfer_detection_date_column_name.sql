/*
  # Fix Transfer Detection Date Column
  
  ## Issue
  The auto_detect_transfers function references `transaction_date` but the actual column is `date`.
  This causes the function to fail when trying to match transfers.
  
  ## Changes
  Replace all occurrences of `transaction_date` with `date` in:
  - auto_detect_transfers function
  - All date comparisons and sorting
*/

-- Enhanced auto-detect function with FIXED date column name
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
    ORDER BY t.date DESC
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
          AND ABS(t2.date - v_transaction.date) <= 30
        ORDER BY ABS(t2.date - v_transaction.date)
        LIMIT 1
      LOOP
        v_found_match := true;

        v_confidence := calculate_transfer_confidence(
          ABS(v_transaction.amount),
          ABS(t2.date - v_transaction.date),
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
            LEAST(v_transaction.date, v_potential_match.date),
            GREATEST(v_transaction.date, v_potential_match.date)
          )
          ON CONFLICT (profile_id, from_account_id, to_account_id)
          DO UPDATE SET
            total_transfers = transfer_patterns.total_transfers + 1,
            total_auto_detected = transfer_patterns.total_auto_detected + 1,
            common_amounts = array_append(transfer_patterns.common_amounts, ABS(v_transaction.amount)),
            average_amount = (transfer_patterns.average_amount * transfer_patterns.total_transfers + ABS(v_transaction.amount)) / (transfer_patterns.total_transfers + 1),
            last_transfer_date = GREATEST(v_transaction.date, v_potential_match.date),
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
          AND ABS(t2.date - v_transaction.date) <= 7
        ORDER BY ABS(t2.date - v_transaction.date)
        LIMIT 1
      LOOP
        v_confidence := calculate_transfer_confidence(
          ABS(v_transaction.amount),
          ABS(t2.date - v_transaction.date),
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
            LEAST(v_transaction.date, v_potential_match.date),
            GREATEST(v_transaction.date, v_potential_match.date)
          )
          ON CONFLICT (profile_id, from_account_id, to_account_id)
          DO UPDATE SET
            total_transfers = transfer_patterns.total_transfers + 1,
            total_auto_detected = transfer_patterns.total_auto_detected + 1,
            common_amounts = array_append(transfer_patterns.common_amounts, ABS(v_transaction.amount)),
            average_amount = (transfer_patterns.average_amount * transfer_patterns.total_transfers + ABS(v_transaction.amount)) / (transfer_patterns.total_transfers + 1),
            last_transfer_date = GREATEST(v_transaction.date, v_potential_match.date),
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

GRANT EXECUTE ON FUNCTION auto_detect_transfers TO authenticated;

COMMENT ON FUNCTION auto_detect_transfers IS 'Enhanced transfer detection that prioritizes reference number matches. Uses correct column names: bank_account_id and date.';
