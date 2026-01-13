/*
  # Fix Transfer Detection Date Casting

  1. Updates
    - Fix date arithmetic to work with DATE type instead of TIMESTAMP
    - Use proper casting for EXTRACT function
*/

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
  v_from_account_id uuid;
  v_to_account_id uuid;
BEGIN
  -- Loop through transactions to check
  FOR v_transaction IN
    SELECT t.*
    FROM transactions t
    WHERE t.profile_id = p_profile_id
      AND t.status = 'pending'
      AND t.transfer_pair_id IS NULL
      AND t.type != 'transfer' -- Only look at non-categorized transfers
      AND (p_transaction_ids IS NULL OR t.id = ANY(p_transaction_ids))
    ORDER BY t.date DESC
  LOOP
    -- Look for potential matching transaction
    FOR v_potential_match IN
      SELECT t2.*
      FROM transactions t2
      WHERE t2.profile_id = p_profile_id
        AND t2.id != v_transaction.id
        AND t2.status = 'pending'
        AND t2.transfer_pair_id IS NULL
        AND t2.bank_account_id != v_transaction.bank_account_id
        -- Opposite types (one income, one expense) with same amount
        AND t2.amount = v_transaction.amount
        AND ((v_transaction.type = 'expense' AND t2.type = 'income') 
          OR (v_transaction.type = 'income' AND t2.type = 'expense'))
        -- Within 7 days
        AND ABS(t2.date - v_transaction.date) <= 7
      ORDER BY ABS(t2.date - v_transaction.date)
      LIMIT 1
    LOOP
      -- Determine from/to accounts
      IF v_transaction.type = 'expense' THEN
        v_from_account_id := v_transaction.bank_account_id;
        v_to_account_id := v_potential_match.bank_account_id;
      ELSE
        v_from_account_id := v_potential_match.bank_account_id;
        v_to_account_id := v_transaction.bank_account_id;
      END IF;

      -- Calculate confidence score (convert date difference to days)
      v_confidence := calculate_transfer_confidence(
        v_transaction.amount,
        ABS(v_potential_match.date - v_transaction.date),
        v_from_account_id,
        v_to_account_id,
        p_profile_id
      );

      -- If confidence is 95% or higher, automatically match
      IF v_confidence >= 95 THEN
        -- Generate new transfer pair ID
        v_transfer_pair_id := gen_random_uuid();

        -- Update both transactions
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
          v_from_account_id,
          v_to_account_id,
          1,
          1,
          ARRAY[v_transaction.amount],
          v_transaction.amount,
          LEAST(v_transaction.date, v_potential_match.date),
          GREATEST(v_transaction.date, v_potential_match.date)
        )
        ON CONFLICT (profile_id, from_account_id, to_account_id) 
        DO UPDATE SET
          total_transfers = transfer_patterns.total_transfers + 1,
          total_auto_detected = transfer_patterns.total_auto_detected + 1,
          common_amounts = array_append(transfer_patterns.common_amounts, v_transaction.amount),
          average_amount = (transfer_patterns.average_amount * transfer_patterns.total_transfers + v_transaction.amount) / (transfer_patterns.total_transfers + 1),
          last_transfer_date = GREATEST(v_transaction.date, v_potential_match.date),
          last_updated = now()
        RETURNING id INTO v_pattern_id;

        -- Update transactions with pattern ID
        UPDATE transactions
        SET transfer_pattern_id = v_pattern_id
        WHERE id IN (v_transaction.id, v_potential_match.id);

        RETURN QUERY SELECT v_transaction.id, v_potential_match.id, v_confidence, true;
      ELSE
        -- Lower confidence - just report but don't auto-match
        RETURN QUERY SELECT v_transaction.id, v_potential_match.id, v_confidence, false;
      END IF;
    END LOOP;
  END LOOP;

  RETURN;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
