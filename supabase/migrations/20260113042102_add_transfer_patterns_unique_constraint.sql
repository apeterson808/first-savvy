/*
  # Add Unique Constraint to Transfer Patterns

  Adds a unique constraint on (profile_id, from_account_id, to_account_id)
  to prevent duplicate patterns and enable UPSERT operations.
*/

-- Add unique constraint to prevent duplicate patterns
ALTER TABLE transfer_patterns
  ADD CONSTRAINT transfer_patterns_profile_accounts_unique
  UNIQUE (profile_id, from_account_id, to_account_id);
