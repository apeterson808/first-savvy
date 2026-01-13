/*
  # Create Pattern Update Functions

  Creates functions to update transfer pattern statistics when users accept or reject auto-detected transfers.

  1. Function: increment_pattern_acceptance
    - Increments total_accepted counter for a pattern
    - Updates last_updated timestamp

  2. Function: increment_pattern_rejection
    - Increments total_rejected counter for a pattern
    - Updates last_updated timestamp
*/

-- Function to increment pattern acceptance
CREATE OR REPLACE FUNCTION increment_pattern_acceptance(p_pattern_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE transfer_patterns
  SET
    total_accepted = total_accepted + 1,
    last_updated = now()
  WHERE id = p_pattern_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment pattern rejection
CREATE OR REPLACE FUNCTION increment_pattern_rejection(p_pattern_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE transfer_patterns
  SET
    total_rejected = total_rejected + 1,
    last_updated = now()
  WHERE id = p_pattern_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_pattern_acceptance TO authenticated;
GRANT EXECUTE ON FUNCTION increment_pattern_rejection TO authenticated;

-- Add comments
COMMENT ON FUNCTION increment_pattern_acceptance IS 'Increments the acceptance counter for a transfer pattern when user accepts an auto-detected transfer.';
COMMENT ON FUNCTION increment_pattern_rejection IS 'Increments the rejection counter for a transfer pattern when user rejects an auto-detected transfer.';
