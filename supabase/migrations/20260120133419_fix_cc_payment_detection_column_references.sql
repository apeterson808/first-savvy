/*
  # Fix Credit Card Payment Detection Column References

  1. Changes
    - Fix column references in auto_detect_credit_card_payments function
    - Change `a.class` to `a.account_type` (correct column name)
    - Change `a.type` to `a.account_detail` (correct column name for sub-classification)
    
  2. Purpose
    - Fix SQL error: "column a.type does not exist"
    - Ensure function works with current user_chart_of_accounts schema
*/

CREATE OR REPLACE FUNCTION auto_detect_credit_card_payments(
  p_profile_id uuid,
  p_transaction_ids uuid[] DEFAULT NULL
)
RETURNS TABLE(
  matched_count integer,
  total_confidence numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_bank_transaction record;
  v_cc_transaction record;
  v_pair_id uuid;
  v_confidence numeric;
  v_pattern_id uuid;
  v_matched_count integer := 0;
  v_total_confidence numeric := 0;
  v_amount_diff numeric;
  v_date_diff integer;
BEGIN
  -- Loop through bank account transactions (withdrawals/debits)
  FOR v_bank_transaction IN
    SELECT
      t.id,
      t.account_id,
      t.amount,
      t.transaction_date,
      t.description,
      a.account_type,
      a.account_detail
    FROM transactions t
    JOIN user_chart_of_accounts a ON t.account_id = a.id
    WHERE t.profile_id = p_profile_id
      AND t.transaction_status = 'pending'
      AND t.amount < 0
      AND t.cc_payment_pair_id IS NULL
      AND t.transfer_pair_id IS NULL
      AND a.account_type = 'asset'
      AND (p_transaction_ids IS NULL OR t.id = ANY(p_transaction_ids))
  LOOP
    -- Look for matching credit card transactions (payments that reduce liability)
    FOR v_cc_transaction IN
      SELECT
        t.id,
        t.account_id,
        t.amount,
        t.transaction_date,
        t.description,
        a.account_type,
        a.account_detail
      FROM transactions t
      JOIN user_chart_of_accounts a ON t.account_id = a.id
      WHERE t.profile_id = p_profile_id
        AND t.transaction_status = 'pending'
        AND t.amount > 0
        AND t.cc_payment_pair_id IS NULL
        AND t.transfer_pair_id IS NULL
        AND a.account_type = 'liability'
        AND a.account_detail = 'credit_card'
        AND ABS(ABS(t.amount) - ABS(v_bank_transaction.amount)) <= (ABS(v_bank_transaction.amount) * 0.01)
        AND ABS(EXTRACT(EPOCH FROM (t.transaction_date - v_bank_transaction.transaction_date)) / 86400) <= 3
        AND (p_transaction_ids IS NULL OR t.id = ANY(p_transaction_ids))
      ORDER BY
        ABS(ABS(t.amount) - ABS(v_bank_transaction.amount)),
        ABS(EXTRACT(EPOCH FROM (t.transaction_date - v_bank_transaction.transaction_date)))
      LIMIT 1
    LOOP
      -- Calculate confidence score
      v_amount_diff := ABS(ABS(v_cc_transaction.amount) - ABS(v_bank_transaction.amount));
      v_date_diff := ABS(EXTRACT(EPOCH FROM (v_cc_transaction.transaction_date - v_bank_transaction.transaction_date)) / 86400)::integer;

      IF v_amount_diff = 0 AND v_date_diff = 0 THEN
        v_confidence := 98;
      ELSIF v_amount_diff = 0 AND v_date_diff = 1 THEN
        v_confidence := 95;
      ELSIF v_amount_diff = 0 AND v_date_diff <= 3 THEN
        v_confidence := 90;
      ELSIF v_amount_diff <= (ABS(v_bank_transaction.amount) * 0.01) AND v_date_diff = 0 THEN
        v_confidence := 85;
      ELSE
        v_confidence := 80;
      END IF;

      -- Generate new pair ID
      v_pair_id := gen_random_uuid();

      -- Check if pattern exists for this bank-credit card pair
      SELECT id INTO v_pattern_id
      FROM credit_card_payment_patterns
      WHERE profile_id = p_profile_id
        AND bank_account_id = v_bank_transaction.account_id
        AND credit_card_account_id = v_cc_transaction.account_id;

      -- Create pattern if it doesn't exist
      IF v_pattern_id IS NULL THEN
        INSERT INTO credit_card_payment_patterns (
          profile_id,
          bank_account_id,
          credit_card_account_id,
          total_payments,
          total_auto_detected,
          first_payment_date,
          last_payment_date,
          average_amount
        ) VALUES (
          p_profile_id,
          v_bank_transaction.account_id,
          v_cc_transaction.account_id,
          1,
          1,
          v_bank_transaction.transaction_date,
          v_bank_transaction.transaction_date,
          ABS(v_bank_transaction.amount)
        )
        RETURNING id INTO v_pattern_id;
      ELSE
        -- Update existing pattern
        UPDATE credit_card_payment_patterns
        SET
          total_auto_detected = total_auto_detected + 1,
          last_payment_date = v_bank_transaction.transaction_date,
          last_updated = now()
        WHERE id = v_pattern_id;
      END IF;

      -- Link both transactions with the pair ID
      UPDATE transactions
      SET
        cc_payment_pair_id = v_pair_id,
        cc_payment_match_confidence = v_confidence,
        cc_payment_auto_detected = true,
        cc_payment_reviewed = false,
        cc_payment_pattern_id = v_pattern_id,
        transaction_type = 'credit_card_payment'
      WHERE id IN (v_bank_transaction.id, v_cc_transaction.id);

      -- Update counters
      v_matched_count := v_matched_count + 1;
      v_total_confidence := v_total_confidence + v_confidence;

      -- Exit inner loop after successful match
      EXIT;
    END LOOP;
  END LOOP;

  RETURN QUERY SELECT v_matched_count, v_total_confidence;
END;
$$;

COMMENT ON FUNCTION auto_detect_credit_card_payments IS
'Automatically detects credit card payment pairs by matching bank withdrawals with credit card payments.
Matches based on amount (within 1% tolerance) and date proximity (within 3 days).
Works on pending transactions to enable immediate detection after import.
Calculates confidence scores and creates/updates payment patterns.';
