/*
  # Create Credit Card Payment Detection and Tracking System

  ## Overview
  This migration creates infrastructure for detecting, tracking, and managing
  credit card payment transactions similar to the transfer system but specific
  to credit card liability account payments.

  ## Changes

  1. New Columns on `transactions` table
    - `cc_payment_pair_id` (uuid) - Links credit card payment transactions together
    - `cc_payment_match_confidence` (numeric) - Confidence score 0-100 for auto-detection
    - `cc_payment_reviewed` (boolean) - Whether user has reviewed the match
    - `cc_payment_auto_detected` (boolean) - Whether automatically detected
    - `cc_payment_pattern_id` (uuid) - Link to pattern that triggered detection

  2. New Table: `credit_card_payment_patterns`
    - Tracks historical payment patterns between bank accounts and credit cards
    - Stores frequency, common amounts, and user acceptance rate
    - Used to improve confidence scoring over time

  ## Security
  - Enable RLS on new table
  - Create appropriate policies for authenticated users
  - Add indexes for query performance

  ## Journal Entry Handling
  Credit card payments create journal entries with:
  - DR Credit Card (Liability) - reduces the liability balance
  - CR Bank Account (Asset) - reduces cash/checking balance
  - Description: "Credit Card Payment" on both lines
*/

-- ============================================================================
-- STEP 1: Add credit card payment columns to transactions table
-- ============================================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS cc_payment_pair_id uuid,
  ADD COLUMN IF NOT EXISTS cc_payment_match_confidence numeric CHECK (cc_payment_match_confidence >= 0 AND cc_payment_match_confidence <= 100),
  ADD COLUMN IF NOT EXISTS cc_payment_reviewed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cc_payment_auto_detected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cc_payment_pattern_id uuid;

-- ============================================================================
-- STEP 2: Create credit_card_payment_patterns table
-- ============================================================================

CREATE TABLE IF NOT EXISTS credit_card_payment_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  bank_account_id uuid NOT NULL REFERENCES user_chart_of_accounts(id) ON DELETE CASCADE,
  credit_card_account_id uuid NOT NULL REFERENCES user_chart_of_accounts(id) ON DELETE CASCADE,

  -- Pattern statistics
  total_payments integer DEFAULT 0,
  total_auto_detected integer DEFAULT 0,
  total_accepted integer DEFAULT 0,
  total_rejected integer DEFAULT 0,
  acceptance_rate numeric GENERATED ALWAYS AS (
    CASE
      WHEN total_auto_detected > 0 THEN (total_accepted::numeric / total_auto_detected::numeric * 100)
      ELSE 0
    END
  ) STORED,

  -- Common patterns
  common_amounts numeric[] DEFAULT '{}',
  common_day_of_month integer[] DEFAULT '{}',
  average_amount numeric,

  -- Timestamps
  first_payment_date timestamptz,
  last_payment_date timestamptz,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),

  -- Ensure unique pattern per bank-credit card pair
  CONSTRAINT unique_payment_pattern UNIQUE (profile_id, bank_account_id, credit_card_account_id)
);

-- ============================================================================
-- STEP 3: Enable RLS and create policies
-- ============================================================================

ALTER TABLE credit_card_payment_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit card payment patterns"
  ON credit_card_payment_patterns FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own credit card payment patterns"
  ON credit_card_payment_patterns FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own credit card payment patterns"
  ON credit_card_payment_patterns FOR UPDATE
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- ============================================================================
-- STEP 4: Create indexes for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_transactions_cc_payment_pair_id
  ON transactions(cc_payment_pair_id)
  WHERE cc_payment_pair_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_cc_payment_confidence
  ON transactions(cc_payment_match_confidence)
  WHERE cc_payment_match_confidence IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_cc_payment_reviewed
  ON transactions(cc_payment_reviewed)
  WHERE cc_payment_auto_detected = true;

CREATE INDEX IF NOT EXISTS idx_transactions_cc_payment_auto_detected
  ON transactions(cc_payment_auto_detected)
  WHERE cc_payment_auto_detected = true;

CREATE INDEX IF NOT EXISTS idx_cc_payment_patterns_accounts
  ON credit_card_payment_patterns(profile_id, bank_account_id, credit_card_account_id);

CREATE INDEX IF NOT EXISTS idx_cc_payment_patterns_acceptance
  ON credit_card_payment_patterns(profile_id, acceptance_rate DESC);

-- ============================================================================
-- STEP 5: Add comments for documentation
-- ============================================================================

COMMENT ON COLUMN transactions.cc_payment_pair_id IS 'Links two transactions together as a credit card payment pair (bank withdrawal + credit card payment).';
COMMENT ON COLUMN transactions.cc_payment_match_confidence IS 'Confidence score (0-100) for auto-detected credit card payments. 95+ is high confidence, 85-94 is medium, below 85 is low.';
COMMENT ON COLUMN transactions.cc_payment_reviewed IS 'Whether the user has explicitly reviewed and accepted/rejected an auto-detected credit card payment match.';
COMMENT ON COLUMN transactions.cc_payment_auto_detected IS 'Whether this credit card payment was automatically detected by the system (vs manually matched by user).';
COMMENT ON TABLE credit_card_payment_patterns IS 'Tracks historical credit card payment patterns between bank accounts and credit cards to improve auto-detection confidence over time.';
