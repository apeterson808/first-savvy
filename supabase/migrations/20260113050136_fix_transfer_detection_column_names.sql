/*
  # Fix Transfer Detection Function Column Names and Logic

  1. Updates
    - Fix column names: transaction_date → date, account_id → bank_account_id
    - Fix amount matching logic to work with positive amounts + type field
    - Match income in one account with expense in another for same amount
*/

-- Helper function to calculate transfer confidence score
CREATE OR REPLACE FUNCTION calculate_transfer_confidence(
  p_amount numeric,
  p_date_diff_days numeric,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_profile_id uuid
) RETURNS numeric AS $$
DECLARE
  v_base_score numeric := 70;
  v_pattern_bonus numeric := 0;
  v_date_penalty numeric := 0;
  v_amount_bonus numeric := 0;
  v_pattern_record RECORD;
BEGIN
  -- Base score starts at 70 for any matching transfer candidate
  
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

  -- Calculate final score
  RETURN LEAST(100, GREATEST(0, v_base_score + v_pattern_bonus + v_amount_bonus - v_date_penalty));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Main function to auto-detect transfers
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
    -- If current transaction is expense (outflow), look for income (inflow) with same amount
    -- If current transaction is income (inflow), look for expense (outflow) with same amount
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
        AND ABS(EXTRACT(EPOCH FROM (t2.date - v_transaction.date)) / 86400) <= 7
      ORDER BY ABS(EXTRACT(EPOCH FROM (t2.date - v_transaction.date)))
      LIMIT 1
    LOOP
      -- Determine from/to accounts
      -- From account is where expense occurs (money leaving)
      -- To account is where income occurs (money arriving)
      IF v_transaction.type = 'expense' THEN
        v_from_account_id := v_transaction.bank_account_id;
        v_to_account_id := v_potential_match.bank_account_id;
      ELSE
        v_from_account_id := v_potential_match.bank_account_id;
        v_to_account_id := v_transaction.bank_account_id;
      END IF;

      -- Calculate confidence score
      v_confidence := calculate_transfer_confidence(
        v_transaction.amount,
        ABS(EXTRACT(EPOCH FROM (v_potential_match.date - v_transaction.date)) / 86400),
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
