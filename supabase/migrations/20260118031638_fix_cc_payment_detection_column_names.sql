/*
  # Fix Credit Card Payment Detection Column Names

  ## Overview
  Fixes the auto_detect_credit_card_payments function to use correct column names
  from user_chart_of_accounts table.

  ## Changes
  - Changes a.type to a.account_type
  - Changes a.account_name to a.display_name
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
  v_desc_lower text;
  v_has_cc_keyword boolean;
BEGIN
  -- Loop through bank account transactions (withdrawals/debits)
  FOR v_bank_transaction IN
    SELECT
      t.id,
      t.bank_account_id,
      t.amount,
      t.date,
      t.description,
      t.original_description,
      a.class as account_class,
      a.account_type as account_type
    FROM transactions t
    JOIN user_chart_of_accounts a ON t.bank_account_id = a.id
    WHERE t.profile_id = p_profile_id
      AND t.status = 'posted'
      AND t.amount < 0  -- Withdrawals only
      AND t.cc_payment_pair_id IS NULL  -- Not already matched
      AND t.transfer_pair_id IS NULL  -- Not a transfer
      AND a.class = 'asset'  -- Must be asset account (bank/checking)
      AND (p_transaction_ids IS NULL OR t.id = ANY(p_transaction_ids))
  LOOP
    -- Check if description contains credit card payment keywords
    v_desc_lower := LOWER(COALESCE(v_bank_transaction.description, '') || ' ' || COALESCE(v_bank_transaction.original_description, ''));
    v_has_cc_keyword := (
      v_desc_lower LIKE '%credit card%' OR
      v_desc_lower LIKE '%cc payment%' OR
      v_desc_lower LIKE '%citi card%' OR
      v_desc_lower LIKE '%amex%' OR
      v_desc_lower LIKE '%american express%' OR
      v_desc_lower LIKE '%discover card%' OR
      v_desc_lower LIKE '%chase card%' OR
      v_desc_lower LIKE '%visa payment%' OR
      v_desc_lower LIKE '%mastercard payment%' OR
      v_desc_lower LIKE '%card payment%' OR
      v_desc_lower LIKE '%epayment%' OR
      v_desc_lower LIKE '%online payment%' OR
      v_desc_lower LIKE '%autopay%' OR
      v_desc_lower LIKE '%auto pay%'
    );

    -- Look for matching credit card transactions
    FOR v_cc_transaction IN
      SELECT
        t.id,
        t.bank_account_id,
        t.amount,
        t.date,
        t.description,
        t.original_description,
        a.class as account_class,
        a.account_type as account_type,
        a.display_name,
        a.institution_name
      FROM transactions t
      JOIN user_chart_of_accounts a ON t.bank_account_id = a.id
      WHERE t.profile_id = p_profile_id
        AND t.status = 'posted'
        AND t.amount > 0  -- Positive amount (payment reduces liability)
        AND t.cc_payment_pair_id IS NULL  -- Not already matched
        AND t.transfer_pair_id IS NULL  -- Not a transfer
        AND a.class = 'liability'  -- Must be liability account
        AND a.account_type = 'credit_card'  -- Specifically credit card
        -- Amount match (within 1% tolerance)
        AND ABS(ABS(t.amount) - ABS(v_bank_transaction.amount)) <= (ABS(v_bank_transaction.amount) * 0.01)
        -- Date proximity (within 3 days)
        AND ABS(EXTRACT(EPOCH FROM (t.date - v_bank_transaction.date)) / 86400) <= 3
        AND (p_transaction_ids IS NULL OR t.id = ANY(p_transaction_ids))
        -- Boost matches where bank description mentions the credit card
        AND (
          NOT v_has_cc_keyword  -- No keyword, match any
          OR v_desc_lower LIKE '%' || LOWER(COALESCE(a.institution_name, '')) || '%'  -- Institution name in description
          OR v_desc_lower LIKE '%' || LOWER(SPLIT_PART(COALESCE(a.display_name, ''), ' ', 1)) || '%'  -- First word of display name
        )
      ORDER BY
        -- Prioritize if bank description mentions this specific card
        CASE WHEN v_has_cc_keyword AND (
          v_desc_lower LIKE '%' || LOWER(COALESCE(a.institution_name, '')) || '%' OR
          v_desc_lower LIKE '%' || LOWER(SPLIT_PART(COALESCE(a.display_name, ''), ' ', 1)) || '%'
        ) THEN 0 ELSE 1 END,
        ABS(ABS(t.amount) - ABS(v_bank_transaction.amount)),  -- Closest amount match
        ABS(EXTRACT(EPOCH FROM (t.date - v_bank_transaction.date)))  -- Closest date match
      LIMIT 1  -- Only match with best candidate
    LOOP
      -- Calculate confidence score
      v_amount_diff := ABS(ABS(v_cc_transaction.amount) - ABS(v_bank_transaction.amount));
      v_date_diff := ABS(EXTRACT(EPOCH FROM (v_cc_transaction.date - v_bank_transaction.date)) / 86400)::integer;

      -- Base confidence on amount and date matching
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

      -- Boost confidence if description contains credit card keywords
      IF v_has_cc_keyword THEN
        v_confidence := LEAST(99, v_confidence + 5);
      END IF;

      -- Generate new pair ID
      v_pair_id := gen_random_uuid();

      -- Check if pattern exists for this bank-credit card pair
      SELECT id INTO v_pattern_id
      FROM credit_card_payment_patterns
      WHERE profile_id = p_profile_id
        AND bank_account_id = v_bank_transaction.bank_account_id
        AND credit_card_account_id = v_cc_transaction.bank_account_id;

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
          v_bank_transaction.bank_account_id,
          v_cc_transaction.bank_account_id,
          1,
          1,
          v_bank_transaction.date,
          v_bank_transaction.date,
          ABS(v_bank_transaction.amount)
        )
        RETURNING id INTO v_pattern_id;
      ELSE
        -- Update existing pattern
        UPDATE credit_card_payment_patterns
        SET
          total_auto_detected = total_auto_detected + 1,
          last_payment_date = v_bank_transaction.date,
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
        type = 'credit_card_payment'
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
