/*
  # Add Transfer Auto-Detection and Review Fields

  This migration adds fields to support QuickBooks-style automatic transfer recognition:

  1. New Columns on `transactions` table
    - `transfer_match_confidence` (numeric) - Confidence score 0-100 for auto-detected transfers
    - `transfer_reviewed` (boolean) - Whether user has reviewed an auto-detected transfer
    - `transfer_auto_detected` (boolean) - Whether this transfer was automatically detected by the system
    - `transfer_pattern_id` (uuid) - Link to the pattern that triggered auto-detection

  2. New Table: `transfer_patterns`
    - Tracks historical transfer patterns between account pairs
    - Used to improve confidence scoring over time
    - Stores frequency, common amounts, and user acceptance rate

  3. Security
    - RLS policies for transfer_patterns table
    - Indexes for performance on pattern matching queries
*/

-- Add transfer auto-detection columns to transactions
ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS transfer_match_confidence numeric CHECK (transfer_match_confidence >= 0 AND transfer_match_confidence <= 100),
  ADD COLUMN IF NOT EXISTS transfer_reviewed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS transfer_auto_detected boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS transfer_pattern_id uuid;

-- Create transfer_patterns table to track recurring transfer patterns
CREATE TABLE IF NOT EXISTS transfer_patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  from_account_id uuid NOT NULL REFERENCES user_chart_of_accounts(id) ON DELETE CASCADE,
  to_account_id uuid NOT NULL REFERENCES user_chart_of_accounts(id) ON DELETE CASCADE,

  -- Pattern statistics
  total_transfers integer DEFAULT 0,
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
  first_transfer_date timestamptz,
  last_transfer_date timestamptz,
  last_updated timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE transfer_patterns ENABLE ROW LEVEL SECURITY;

-- RLS Policies for transfer_patterns
CREATE POLICY "Users can view own transfer patterns"
  ON transfer_patterns FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own transfer patterns"
  ON transfer_patterns FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own transfer patterns"
  ON transfer_patterns FOR UPDATE
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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_transfer_confidence
  ON transactions(transfer_match_confidence)
  WHERE transfer_match_confidence IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_transfer_reviewed
  ON transactions(transfer_reviewed)
  WHERE transfer_auto_detected = true;

CREATE INDEX IF NOT EXISTS idx_transactions_transfer_auto_detected
  ON transactions(transfer_auto_detected)
  WHERE transfer_auto_detected = true;

CREATE INDEX IF NOT EXISTS idx_transfer_patterns_accounts
  ON transfer_patterns(profile_id, from_account_id, to_account_id);

CREATE INDEX IF NOT EXISTS idx_transfer_patterns_acceptance
  ON transfer_patterns(profile_id, acceptance_rate DESC);

-- Add comment for documentation
COMMENT ON COLUMN transactions.transfer_match_confidence IS 'Confidence score (0-100) for auto-detected transfers. 95+ is high confidence, 85-94 is medium, below 85 is low.';
COMMENT ON COLUMN transactions.transfer_reviewed IS 'Whether the user has explicitly reviewed and accepted/rejected an auto-detected transfer match.';
COMMENT ON COLUMN transactions.transfer_auto_detected IS 'Whether this transfer was automatically detected by the system (vs manually matched by user).';
COMMENT ON TABLE transfer_patterns IS 'Tracks historical transfer patterns between account pairs to improve auto-detection confidence over time.';
