/*
  # Remove Duplicate Policies and Final Cleanup

  ## Changes
  1. Remove old duplicate policies from categorization_rules, contact_matching_rules, and transaction_splits
  2. These tables had both "own" and "for their profiles" versions of policies
*/

-- =====================================================
-- REMOVE OLD DUPLICATE POLICIES
-- =====================================================

-- Remove old categorization_rules policies (keeping the "for their profiles" versions)
DROP POLICY IF EXISTS "Users can view own categorization rules" ON categorization_rules;
DROP POLICY IF EXISTS "Users can insert own categorization rules" ON categorization_rules;
DROP POLICY IF EXISTS "Users can update own categorization rules" ON categorization_rules;
DROP POLICY IF EXISTS "Users can delete own categorization rules" ON categorization_rules;

-- Remove old contact_matching_rules policies (keeping the "for their profiles" versions)
DROP POLICY IF EXISTS "Users can view own contact matching rules" ON contact_matching_rules;
DROP POLICY IF EXISTS "Users can insert own contact matching rules" ON contact_matching_rules;
DROP POLICY IF EXISTS "Users can update own contact matching rules" ON contact_matching_rules;
DROP POLICY IF EXISTS "Users can delete own contact matching rules" ON contact_matching_rules;

-- Remove old transaction_splits policies (keeping the "for their profiles" versions)
DROP POLICY IF EXISTS "Users can view own transaction splits" ON transaction_splits;
DROP POLICY IF EXISTS "Users can insert own transaction splits" ON transaction_splits;
DROP POLICY IF EXISTS "Users can update own transaction splits" ON transaction_splits;
DROP POLICY IF EXISTS "Users can delete own transaction splits" ON transaction_splits;
