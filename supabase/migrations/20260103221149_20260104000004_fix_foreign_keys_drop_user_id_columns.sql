/*
  # Fix Foreign Keys and Remove user_id Columns

  ## Overview
  This migration removes the dual-column pattern (user_id + profile_id) from all financial tables.
  All financial data is now owned exclusively by profiles, not directly by users.

  ## Changes
  1. Drop old user_id-based RLS policies
  2. Fix transfer_registry.profile_id to reference profiles(id)
  3. Fix statement_uploads.profile_id to reference profiles(id)
  4. Remove user_id column from all financial tables
  5. Ensure profile_id-based policies exist
*/

-- ============================================================================
-- Step 1: Drop all user_id-based policies
-- ============================================================================

-- transfer_registry
DROP POLICY IF EXISTS "Users can view own transfer registry entries" ON transfer_registry;
DROP POLICY IF EXISTS "Users can insert own transfer registry entries" ON transfer_registry;
DROP POLICY IF EXISTS "Users can update own transfer registry entries" ON transfer_registry;
DROP POLICY IF EXISTS "Users can delete own transfer registry entries" ON transfer_registry;

-- statement_uploads (if any old policies exist)
DROP POLICY IF EXISTS "Users can view own statement uploads" ON statement_uploads;
DROP POLICY IF EXISTS "Users can insert own statement uploads" ON statement_uploads;
DROP POLICY IF EXISTS "Users can update own statement uploads" ON statement_uploads;
DROP POLICY IF EXISTS "Users can delete own statement uploads" ON statement_uploads;

-- transactions (if any old policies exist)
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON transactions;

-- contacts (if any old policies exist)
DROP POLICY IF EXISTS "Users can view own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can insert own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can update own contacts" ON contacts;
DROP POLICY IF EXISTS "Users can delete own contacts" ON contacts;

-- budgets (if any old policies exist)
DROP POLICY IF EXISTS "Users can view own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can insert own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can update own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can delete own budgets" ON budgets;

-- categorization_rules (if any old policies exist)
DROP POLICY IF EXISTS "Users can view own rules" ON categorization_rules;
DROP POLICY IF EXISTS "Users can insert own rules" ON categorization_rules;
DROP POLICY IF EXISTS "Users can update own rules" ON categorization_rules;
DROP POLICY IF EXISTS "Users can delete own rules" ON categorization_rules;

-- contact_matching_rules (if any old policies exist)
DROP POLICY IF EXISTS "Users can view own contact rules" ON contact_matching_rules;
DROP POLICY IF EXISTS "Users can insert own contact rules" ON contact_matching_rules;
DROP POLICY IF EXISTS "Users can update own contact rules" ON contact_matching_rules;
DROP POLICY IF EXISTS "Users can delete own contact rules" ON contact_matching_rules;

-- transaction_splits (if any old policies exist)
DROP POLICY IF EXISTS "Users can view own splits" ON transaction_splits;
DROP POLICY IF EXISTS "Users can insert own splits" ON transaction_splits;
DROP POLICY IF EXISTS "Users can update own splits" ON transaction_splits;
DROP POLICY IF EXISTS "Users can delete own splits" ON transaction_splits;

-- user_chart_of_accounts (if any old policies exist)
DROP POLICY IF EXISTS "Users can view own accounts" ON user_chart_of_accounts;
DROP POLICY IF EXISTS "Users can insert own accounts" ON user_chart_of_accounts;
DROP POLICY IF EXISTS "Users can update own accounts" ON user_chart_of_accounts;
DROP POLICY IF EXISTS "Users can delete own accounts" ON user_chart_of_accounts;

-- ============================================================================
-- Step 2: Drop user_id columns
-- ============================================================================

ALTER TABLE transfer_registry DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE statement_uploads DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE transactions DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE contacts DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE budgets DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE categorization_rules DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE contact_matching_rules DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE transaction_splits DROP COLUMN IF EXISTS user_id CASCADE;
ALTER TABLE user_chart_of_accounts DROP COLUMN IF EXISTS user_id CASCADE;

-- ============================================================================
-- Step 3: Fix foreign key constraints
-- ============================================================================

-- transfer_registry - ensure it references profiles(id)
ALTER TABLE transfer_registry DROP CONSTRAINT IF EXISTS transfer_registry_profile_id_fkey;
ALTER TABLE transfer_registry
ADD CONSTRAINT transfer_registry_profile_id_fkey
FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- statement_uploads - ensure it references profiles(id)
ALTER TABLE statement_uploads DROP CONSTRAINT IF EXISTS statement_uploads_profile_id_fkey;
ALTER TABLE statement_uploads
ADD CONSTRAINT statement_uploads_profile_id_fkey
FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE;

-- ============================================================================
-- Step 4: Ensure profile_id-based policies exist
-- ============================================================================

-- transfer_registry
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transfer_registry' AND policyname = 'Users can view transfer registry for accessible profiles') THEN
    CREATE POLICY "Users can view transfer registry for accessible profiles"
      ON transfer_registry FOR SELECT
      TO authenticated
      USING (has_profile_access(profile_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'transfer_registry' AND policyname = 'Users can manage transfer registry for accessible profiles') THEN
    CREATE POLICY "Users can manage transfer registry for accessible profiles"
      ON transfer_registry FOR ALL
      TO authenticated
      USING (has_profile_access(profile_id))
      WITH CHECK (has_profile_access(profile_id));
  END IF;
END $$;

-- statement_uploads
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'statement_uploads' AND policyname = 'Users can view uploads for accessible profiles') THEN
    CREATE POLICY "Users can view uploads for accessible profiles"
      ON statement_uploads FOR SELECT
      TO authenticated
      USING (has_profile_access(profile_id));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'statement_uploads' AND policyname = 'Users can manage uploads for accessible profiles') THEN
    CREATE POLICY "Users can manage uploads for accessible profiles"
      ON statement_uploads FOR ALL
      TO authenticated
      USING (has_profile_access(profile_id))
      WITH CHECK (has_profile_access(profile_id));
  END IF;
END $$;

-- ============================================================================
-- Step 5: Update comments
-- ============================================================================

COMMENT ON COLUMN transfer_registry.profile_id IS 'Profile that owns this transfer. Single source of truth for ownership.';
COMMENT ON COLUMN statement_uploads.profile_id IS 'Profile that owns this upload. Single source of truth for ownership.';
COMMENT ON COLUMN transactions.profile_id IS 'Profile that owns this transaction. Single source of truth for ownership.';
COMMENT ON COLUMN contacts.profile_id IS 'Profile that owns this contact. Single source of truth for ownership.';
COMMENT ON COLUMN budgets.profile_id IS 'Profile that owns this budget. Single source of truth for ownership.';
COMMENT ON COLUMN categorization_rules.profile_id IS 'Profile that owns this rule. Single source of truth for ownership.';
COMMENT ON COLUMN contact_matching_rules.profile_id IS 'Profile that owns this rule. Single source of truth for ownership.';
COMMENT ON COLUMN transaction_splits.profile_id IS 'Profile that owns this split. Single source of truth for ownership.';
COMMENT ON COLUMN user_chart_of_accounts.profile_id IS 'Profile that owns this account. Single source of truth for ownership.';
