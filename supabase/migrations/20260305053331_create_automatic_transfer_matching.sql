/*
  # Create Automatic Transfer Matching System

  1. New Tables
    - `transfer_match_suggestions`
      - `id` (uuid, primary key)
      - `profile_id` (uuid, references profiles)
      - `transaction_1_id` (uuid, references transactions)
      - `transaction_2_id` (uuid, references transactions)
      - `confidence_score` (numeric) - Score from 0-100 indicating match confidence
      - `match_reasons` (jsonb) - Array of reasons why these might match
      - `status` (text) - 'pending', 'accepted', 'rejected', 'auto_matched'
      - `auto_matched_at` (timestamptz) - When automatically matched (null if manual)
      - `created_at` (timestamptz)

  2. Functions
    - `find_transfer_matches` - Finds potential transfer matches for a transaction
    - `auto_match_transfers` - Automatically matches high-confidence transfers
    - `apply_transfer_match` - Applies a match suggestion

  3. Security
    - Enable RLS on `transfer_match_suggestions` table
    - Add policies for users with profile access

  4. Important Notes
    - High confidence matches (score >= 90) are automatically applied
    - Medium confidence matches (score 70-89) are stored as suggestions
    - Low confidence matches (score < 70) are ignored
    - Matching criteria: opposite amounts, similar dates, different accounts, both transfers
*/

-- Create transfer match suggestions table
CREATE TABLE IF NOT EXISTS transfer_match_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  transaction_1_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  transaction_2_id uuid NOT NULL REFERENCES transactions(id) ON DELETE CASCADE,
  confidence_score numeric NOT NULL CHECK (confidence_score >= 0 AND confidence_score <= 100),
  match_reasons jsonb DEFAULT '[]'::jsonb,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'auto_matched')),
  auto_matched_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(transaction_1_id, transaction_2_id)
);

-- Enable RLS
ALTER TABLE transfer_match_suggestions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view transfer match suggestions for their profiles"
  ON transfer_match_suggestions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profile_memberships pm
      WHERE pm.profile_id = transfer_match_suggestions.profile_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert transfer match suggestions for their profiles"
  ON transfer_match_suggestions FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profile_memberships pm
      WHERE pm.profile_id = transfer_match_suggestions.profile_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update transfer match suggestions for their profiles"
  ON transfer_match_suggestions FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profile_memberships pm
      WHERE pm.profile_id = transfer_match_suggestions.profile_id
      AND pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profile_memberships pm
      WHERE pm.profile_id = transfer_match_suggestions.profile_id
      AND pm.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete transfer match suggestions for their profiles"
  ON transfer_match_suggestions FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profile_memberships pm
      WHERE pm.profile_id = transfer_match_suggestions.profile_id
      AND pm.user_id = auth.uid()
    )
  );

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_transfer_match_suggestions_profile_status
  ON transfer_match_suggestions(profile_id, status);
CREATE INDEX IF NOT EXISTS idx_transfer_match_suggestions_transaction_1
  ON transfer_match_suggestions(transaction_1_id);
CREATE INDEX IF NOT EXISTS idx_transfer_match_suggestions_transaction_2
  ON transfer_match_suggestions(transaction_2_id);

-- Function to find potential transfer matches for a transaction
CREATE OR REPLACE FUNCTION find_transfer_matches(
  p_transaction_id uuid,
  p_profile_id uuid
)
RETURNS TABLE (
  match_transaction_id uuid,
  confidence_score numeric,
  match_reasons jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_transaction record;
  v_target_amount numeric;
BEGIN
  -- Get the source transaction
  SELECT * INTO v_transaction
  FROM transactions
  WHERE id = p_transaction_id AND profile_id = p_profile_id AND type = 'transfer' AND status = 'pending';

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Check if already matched
  IF v_transaction.paired_transfer_id IS NOT NULL THEN
    RETURN;
  END IF;

  v_target_amount := v_transaction.amount * -1;

  -- Find potential matches
  RETURN QUERY
  SELECT
    t.id as match_transaction_id,
    (
      100 -
      (ABS(EXTRACT(EPOCH FROM (t.date - v_transaction.date)) / 86400) * 2) -
      (CASE
        WHEN LOWER(t.description) = LOWER(v_transaction.description) THEN 0
        ELSE 5
      END)
    )::numeric as confidence_score,
    jsonb_build_array(
      jsonb_build_object('reason', 'opposite_amount', 'value', t.amount),
      jsonb_build_object('reason', 'date_difference_days', 'value', ABS(EXTRACT(EPOCH FROM (t.date - v_transaction.date)) / 86400)),
      jsonb_build_object('reason', 'different_accounts', 'value', true)
    ) as match_reasons
  FROM transactions t
  WHERE t.profile_id = p_profile_id
    AND t.id != p_transaction_id
    AND t.type = 'transfer'
    AND t.status = 'pending'
    AND t.bank_account_id != v_transaction.bank_account_id
    AND t.amount = v_target_amount
    AND t.paired_transfer_id IS NULL
    AND ABS(EXTRACT(EPOCH FROM (t.date - v_transaction.date)) / 86400) <= 7
  ORDER BY confidence_score DESC
  LIMIT 10;
END;
$$;

-- Function to automatically match high-confidence transfers
CREATE OR REPLACE FUNCTION auto_match_transfers(
  p_profile_id uuid,
  p_min_confidence numeric DEFAULT 90
)
RETURNS TABLE (
  matched_count integer,
  suggestion_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match record;
  v_matched_count integer := 0;
  v_suggestion_count integer := 0;
BEGIN
  -- Find all unmatched pending transfers
  FOR v_match IN
    SELECT
      t.id as transaction_id,
      m.match_transaction_id,
      m.confidence_score,
      m.match_reasons
    FROM transactions t
    CROSS JOIN LATERAL find_transfer_matches(t.id, p_profile_id) m
    WHERE t.profile_id = p_profile_id
      AND t.type = 'transfer'
      AND t.status = 'pending'
      AND t.paired_transfer_id IS NULL
      AND m.confidence_score >= 70
  LOOP
    IF v_match.confidence_score >= p_min_confidence THEN
      -- Auto-match high confidence
      BEGIN
        UPDATE transactions
        SET paired_transfer_id = v_match.match_transaction_id, is_transfer_pair = true
        WHERE id = v_match.transaction_id AND paired_transfer_id IS NULL;

        UPDATE transactions
        SET paired_transfer_id = v_match.transaction_id, is_transfer_pair = true
        WHERE id = v_match.match_transaction_id AND paired_transfer_id IS NULL;

        -- Record as auto-matched suggestion
        INSERT INTO transfer_match_suggestions (
          profile_id, transaction_1_id, transaction_2_id,
          confidence_score, match_reasons, status, auto_matched_at
        ) VALUES (
          p_profile_id, v_match.transaction_id, v_match.match_transaction_id,
          v_match.confidence_score, v_match.match_reasons, 'auto_matched', now()
        ) ON CONFLICT (transaction_1_id, transaction_2_id) DO NOTHING;

        v_matched_count := v_matched_count + 1;
      EXCEPTION WHEN OTHERS THEN
        -- Skip if conflict
        CONTINUE;
      END;
    ELSE
      -- Store as suggestion for manual review
      INSERT INTO transfer_match_suggestions (
        profile_id, transaction_1_id, transaction_2_id,
        confidence_score, match_reasons, status
      ) VALUES (
        p_profile_id, v_match.transaction_id, v_match.match_transaction_id,
        v_match.confidence_score, v_match.match_reasons, 'pending'
      ) ON CONFLICT (transaction_1_id, transaction_2_id) DO NOTHING;

      v_suggestion_count := v_suggestion_count + 1;
    END IF;
  END LOOP;

  RETURN QUERY SELECT v_matched_count, v_suggestion_count;
END;
$$;

-- Function to apply a match suggestion
CREATE OR REPLACE FUNCTION apply_transfer_match(
  p_suggestion_id uuid,
  p_profile_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_suggestion record;
BEGIN
  -- Get the suggestion
  SELECT * INTO v_suggestion
  FROM transfer_match_suggestions
  WHERE id = p_suggestion_id AND profile_id = p_profile_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  -- Apply the match
  UPDATE transactions
  SET paired_transfer_id = v_suggestion.transaction_2_id, is_transfer_pair = true
  WHERE id = v_suggestion.transaction_1_id AND paired_transfer_id IS NULL;

  UPDATE transactions
  SET paired_transfer_id = v_suggestion.transaction_1_id, is_transfer_pair = true
  WHERE id = v_suggestion.transaction_2_id AND paired_transfer_id IS NULL;

  -- Update suggestion status
  UPDATE transfer_match_suggestions
  SET status = 'accepted'
  WHERE id = p_suggestion_id;

  RETURN true;
END;
$$;

-- Trigger to auto-match transfers when new transfer transactions are created
CREATE OR REPLACE FUNCTION trigger_auto_match_on_transfer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only process if it's a pending transfer without a pair
  IF NEW.type = 'transfer' AND NEW.status = 'pending' AND NEW.paired_transfer_id IS NULL THEN
    -- Try to find and auto-match
    PERFORM auto_match_transfers(NEW.profile_id, 90);
  END IF;

  RETURN NEW;
END;
$$;

-- Create trigger
DROP TRIGGER IF EXISTS auto_match_transfer_on_insert ON transactions;
CREATE TRIGGER auto_match_transfer_on_insert
  AFTER INSERT ON transactions
  FOR EACH ROW
  EXECUTE FUNCTION trigger_auto_match_on_transfer();