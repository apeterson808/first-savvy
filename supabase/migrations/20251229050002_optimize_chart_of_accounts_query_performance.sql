/*
  # Optimize Chart of Accounts Query Performance

  ## Overview
  Adds a compound index on user_chart_of_accounts to speed up queries that filter by profile_id,
  which is the primary query pattern used when loading the accounts page.

  ## Changes
  - Add compound index on (profile_id, is_active) for faster filtering
  - Add compound index on (user_id, profile_id) to optimize RLS policy checks

  ## Performance Impact
  - Should significantly reduce query time when loading accounts
  - Optimizes both the query filter and RLS policy evaluation
*/

-- Compound index for the common query pattern (profile_id with optional is_active filter)
CREATE INDEX IF NOT EXISTS idx_user_coa_profile_active 
  ON user_chart_of_accounts(profile_id, is_active);

-- Compound index to optimize RLS policy checks
CREATE INDEX IF NOT EXISTS idx_user_coa_user_profile 
  ON user_chart_of_accounts(user_id, profile_id);

-- Also ensure profile_memberships has a compound index for the RLS function
CREATE INDEX IF NOT EXISTS idx_profile_memberships_user_profile 
  ON profile_memberships(user_id, profile_id);

-- Analyze tables to update statistics for query planner
ANALYZE user_chart_of_accounts;
ANALYZE profile_memberships;