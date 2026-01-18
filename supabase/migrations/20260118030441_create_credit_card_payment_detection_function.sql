/*
  # Create Credit Card Payment Auto-Detection Function

  ## Overview
  Implements automatic detection of credit card payment transactions based on
  amount matching, date proximity, and account type validation.

  ## Functions Created

  1. `auto_detect_credit_card_payments(p_profile_id, p_transaction_ids)`
     - Detects potential credit card payment pairs
     - Calculates confidence scores based on multiple factors
     - Creates or updates payment patterns
     - Links transactions with cc_payment_pair_id

  2. `increment_cc_payment_pattern_acceptance(p_pattern_id)`
     - Updates pattern statistics when user accepts a match

  3. `increment_cc_payment_pattern_rejection(p_pattern_id)`
     - Updates pattern statistics when user rejects a match

  ## Detection Logic
  - Matches bank account withdrawals with credit card payments
  - Same or very close amounts (within 1% tolerance)
  - Date within 3 days of each other
  - Both transactions must be unmatched
  - Confidence scoring:
    - Exact amount + same day = 98
    - Exact amount + 1 day apart = 95
    - Exact amount + 2-3 days = 90
    - Within 1% amount + same day = 85
    - Within 1% amount + 1-3 days = 80
*/

-- ============================================================================
-- STEP 1: Create auto-detection function
-- ============================================================================

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
      t.bank_account_id,
      t.amount,
      t.date,
      t.description,
      a.class as account_class,
      a.type as account_type
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
    -- Look for matching credit card transactions (payments that reduce liability)
    FOR v_cc_transaction IN
      SELECT
        t.id,
        t.bank_account_id,
        t.amount,
        t.date,
        t.description,
        a.class as account_class,
        a.type as account_type
      FROM transactions t
      JOIN user_chart_of_accounts a ON t.bank_account_id = a.id
      WHERE t.profile_id = p_profile_id
        AND t.status = 'posted'
        AND t.amount > 0  -- Positive amount (payment reduces liability)
        AND t.cc_payment_pair_id IS NULL  -- Not already matched
        AND t.transfer_pair_id IS NULL  -- Not a transfer
        AND a.class = 'liability'  -- Must be liability account (credit card)
        AND a.type = 'credit_card'  -- Specifically credit card type
        -- Amount match (within 1% tolerance)
        AND ABS(ABS(t.amount) - ABS(v_bank_transaction.amount)) <= (ABS(v_bank_transaction.amount) * 0.01)
        -- Date proximity (within 3 days)
        AND ABS(EXTRACT(EPOCH FROM (t.date - v_bank_transaction.date)) / 86400) <= 3
        AND (p_transaction_ids IS NULL OR t.id = ANY(p_transaction_ids))
      ORDER BY
        ABS(ABS(t.amount) - ABS(v_bank_transaction.amount)),  -- Closest amount match first
        ABS(EXTRACT(EPOCH FROM (t.date - v_bank_transaction.date)))  -- Closest date match second
      LIMIT 1  -- Only match with best candidate
    LOOP
      -- Calculate confidence score
      v_amount_diff := ABS(ABS(v_cc_transaction.amount) - ABS(v_bank_transaction.amount));
      v_date_diff := ABS(EXTRACT(EPOCH FROM (v_cc_transaction.date - v_bank_transaction.date)) / 86400)::integer;

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

COMMENT ON FUNCTION auto_detect_credit_card_payments IS
'Automatically detects credit card payment pairs by matching bank withdrawals with credit card payments.
Matches based on amount (within 1% tolerance) and date proximity (within 3 days).
Calculates confidence scores and creates/updates payment patterns.';

-- ============================================================================
-- STEP 2: Create pattern acceptance tracking function
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_cc_payment_pattern_acceptance(
  p_pattern_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE credit_card_payment_patterns
  SET
    total_accepted = total_accepted + 1,
    total_payments = total_payments + 1,
    last_updated = now()
  WHERE id = p_pattern_id;
END;
$$;

COMMENT ON FUNCTION increment_cc_payment_pattern_acceptance IS
'Increments the acceptance counter for a credit card payment pattern when user confirms a match.';

-- ============================================================================
-- STEP 3: Create pattern rejection tracking function
-- ============================================================================

CREATE OR REPLACE FUNCTION increment_cc_payment_pattern_rejection(
  p_pattern_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE credit_card_payment_patterns
  SET
    total_rejected = total_rejected + 1,
    last_updated = now()
  WHERE id = p_pattern_id;
END;
$$;

COMMENT ON FUNCTION increment_cc_payment_pattern_rejection IS
'Increments the rejection counter for a credit card payment pattern when user rejects a match.';
