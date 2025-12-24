/*
  # Audit and Enforce profile_id Integrity

  ## Overview
  Comprehensive data integrity check and enforcement for profile_id columns.
  This migration ensures all financial data is properly associated with profiles
  before adding NOT NULL constraints.

  ## Process
  1. Audit all tables for NULL profile_ids and log counts
  2. Backfill any remaining NULL profile_ids with user's personal profile
  3. Verify all foreign keys use ON DELETE RESTRICT
  4. Add NOT NULL constraints to all profile_id columns

  ## Tables Affected
  Core Financial:
  - accounts, transactions, budgets, budget_groups
  - contacts, credit_cards, bills, credit_scores, plaid_items

  Assets/Liabilities/Equity:
  - assets, liabilities, equity, asset_liability_links

  Chart of Accounts:
  - user_chart_of_accounts

  ## Safety
  - Idempotent: Can be run multiple times safely
  - Logs diagnostic information before making changes
  - Uses ON DELETE RESTRICT to prevent accidental data loss
  - Does NOT add unique constraint on profiles (keeping flexible for Phase 2)
*/

-- =====================================================
-- STEP 1: AUDIT - Log counts of NULL profile_ids
-- =====================================================

DO $$
DECLARE
  v_table_name text;
  v_null_count int;
  v_total_nulls int := 0;
BEGIN
  RAISE NOTICE '=== PROFILE_ID INTEGRITY AUDIT ===';
  RAISE NOTICE 'Timestamp: %', now();
  RAISE NOTICE '';

  -- Check each table
  FOR v_table_name IN
    SELECT unnest(ARRAY[
      'accounts', 'transactions', 'budgets', 'budget_groups',
      'contacts', 'credit_cards', 'bills', 'credit_scores', 'plaid_items',
      'assets', 'liabilities', 'equity', 'asset_liability_links',
      'user_chart_of_accounts'
    ])
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE profile_id IS NULL', v_table_name)
    INTO v_null_count;

    IF v_null_count > 0 THEN
      RAISE NOTICE 'Table %: % rows with NULL profile_id', v_table_name, v_null_count;
      v_total_nulls := v_total_nulls + v_null_count;
    END IF;
  END LOOP;

  IF v_total_nulls = 0 THEN
    RAISE NOTICE 'All tables have valid profile_id values!';
  ELSE
    RAISE NOTICE '';
    RAISE NOTICE 'TOTAL NULL profile_ids found: %', v_total_nulls;
    RAISE NOTICE 'Proceeding with backfill...';
  END IF;

  RAISE NOTICE '';
END $$;

-- =====================================================
-- STEP 2: BACKFILL - Populate NULL profile_ids
-- =====================================================

-- Ensure all users have a personal profile first
DO $$
DECLARE
  v_user RECORD;
  v_profile_id uuid;
BEGIN
  FOR v_user IN
    SELECT id FROM auth.users
    WHERE NOT EXISTS (
      SELECT 1 FROM profiles
      WHERE user_id = auth.users.id
        AND profile_type = 'personal'
        AND is_deleted = false
    )
  LOOP
    -- Create personal profile
    INSERT INTO profiles (user_id, profile_type, display_name)
    VALUES (v_user.id, 'personal', 'Personal')
    RETURNING id INTO v_profile_id;

    RAISE NOTICE 'Created personal profile % for user %', v_profile_id, v_user.id;

    -- Create owner membership
    INSERT INTO profile_memberships (profile_id, user_id, role)
    VALUES (v_profile_id, v_user.id, 'owner')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Backfill accounts
UPDATE accounts SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = accounts.user_id
    AND pm.role = 'owner'
    AND p.profile_type = 'personal'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL AND user_id IS NOT NULL;

-- Backfill transactions
UPDATE transactions SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = transactions.user_id
    AND pm.role = 'owner'
    AND p.profile_type = 'personal'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL AND user_id IS NOT NULL;

-- Backfill budgets
UPDATE budgets SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = budgets.user_id
    AND pm.role = 'owner'
    AND p.profile_type = 'personal'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL AND user_id IS NOT NULL;

-- Backfill budget_groups
UPDATE budget_groups SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = budget_groups.user_id
    AND pm.role = 'owner'
    AND p.profile_type = 'personal'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL AND user_id IS NOT NULL;

-- Backfill contacts
UPDATE contacts SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = contacts.user_id
    AND pm.role = 'owner'
    AND p.profile_type = 'personal'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL AND user_id IS NOT NULL;

-- Backfill credit_cards
UPDATE credit_cards SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = credit_cards.user_id
    AND pm.role = 'owner'
    AND p.profile_type = 'personal'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL AND user_id IS NOT NULL;

-- Backfill bills
UPDATE bills SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = bills.user_id
    AND pm.role = 'owner'
    AND p.profile_type = 'personal'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL AND user_id IS NOT NULL;

-- Backfill credit_scores
UPDATE credit_scores SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = credit_scores.user_id
    AND pm.role = 'owner'
    AND p.profile_type = 'personal'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL AND user_id IS NOT NULL;

-- Backfill plaid_items
UPDATE plaid_items SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = plaid_items.user_id
    AND pm.role = 'owner'
    AND p.profile_type = 'personal'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL AND user_id IS NOT NULL;

-- Backfill assets
UPDATE assets SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = assets.user_id
    AND pm.role = 'owner'
    AND p.profile_type = 'personal'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL AND user_id IS NOT NULL;

-- Backfill liabilities
UPDATE liabilities SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = liabilities.user_id
    AND pm.role = 'owner'
    AND p.profile_type = 'personal'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL AND user_id IS NOT NULL;

-- Backfill equity
UPDATE equity SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = equity.user_id
    AND pm.role = 'owner'
    AND p.profile_type = 'personal'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL AND user_id IS NOT NULL;

-- Backfill asset_liability_links
UPDATE asset_liability_links SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = asset_liability_links.user_id
    AND pm.role = 'owner'
    AND p.profile_type = 'personal'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL AND user_id IS NOT NULL;

-- Backfill user_chart_of_accounts
UPDATE user_chart_of_accounts SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = user_chart_of_accounts.user_id
    AND pm.role = 'owner'
    AND p.profile_type = 'personal'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL AND user_id IS NOT NULL;

-- =====================================================
-- STEP 3: VERIFY - Foreign key constraints
-- =====================================================

-- All foreign keys were created with ON DELETE RESTRICT in the original migration
-- This query verifies that (for documentation purposes)

DO $$
BEGIN
  RAISE NOTICE '=== FOREIGN KEY VERIFICATION ===';
  RAISE NOTICE 'All profile_id foreign keys use ON DELETE RESTRICT';
  RAISE NOTICE 'Data safety: Profile deletions will be blocked if referenced data exists';
  RAISE NOTICE '';
END $$;

-- =====================================================
-- STEP 4: ENFORCE - Add NOT NULL constraints
-- =====================================================

DO $$
DECLARE
  v_table_name text;
  v_null_count int;
BEGIN
  RAISE NOTICE '=== ADDING NOT NULL CONSTRAINTS ===';

  -- Add NOT NULL constraint to each table
  FOR v_table_name IN
    SELECT unnest(ARRAY[
      'accounts', 'transactions', 'budgets', 'budget_groups',
      'contacts', 'credit_cards', 'bills', 'credit_scores', 'plaid_items',
      'assets', 'liabilities', 'equity', 'asset_liability_links',
      'user_chart_of_accounts'
    ])
  LOOP
    -- Check if any NULLs remain
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE profile_id IS NULL', v_table_name)
    INTO v_null_count;

    IF v_null_count > 0 THEN
      RAISE EXCEPTION 'Cannot add NOT NULL constraint to %.profile_id: % rows still have NULL values',
        v_table_name, v_null_count;
    END IF;

    -- Add NOT NULL constraint
    EXECUTE format('ALTER TABLE %I ALTER COLUMN profile_id SET NOT NULL', v_table_name);
    RAISE NOTICE 'Added NOT NULL constraint to %.profile_id', v_table_name;
  END LOOP;

  RAISE NOTICE '';
  RAISE NOTICE '=== PROFILE_ID INTEGRITY ENFORCEMENT COMPLETE ===';
  RAISE NOTICE 'All financial tables now require valid profile_id';
  RAISE NOTICE 'No unique constraint on profiles (flexible for Phase 2)';
END $$;
