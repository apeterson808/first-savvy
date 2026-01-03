/*
  # Migrate Existing Data to Profile System

  ## Overview
  Migrates all existing user data to use the new profile system.
  Creates personal profiles for users who don't have one, and populates
  profile_id in all financial tables based on user_id.

  ## Process
  1. Create personal profiles for all users without profiles
  2. Create profile memberships for all users
  3. Populate profile_id in all financial tables based on user_id

  ## Safety
  - Idempotent: Can be run multiple times safely
  - Does not delete or modify user_id columns
  - Only updates NULL profile_id values
*/

-- Step 1: Create personal profiles for all users who don't have one
DO $$
DECLARE
  v_user RECORD;
  v_profile_id uuid;
BEGIN
  FOR v_user IN 
    SELECT id FROM auth.users
    WHERE NOT EXISTS (
      SELECT 1 FROM profiles WHERE user_id = auth.users.id
    )
  LOOP
    -- Create profile
    INSERT INTO profiles (user_id, profile_type, display_name)
    VALUES (v_user.id, 'personal', 'Personal')
    RETURNING id INTO v_profile_id;

    -- Create membership
    INSERT INTO profile_memberships (profile_id, user_id, role)
    VALUES (v_profile_id, v_user.id, 'owner')
    ON CONFLICT DO NOTHING;
  END LOOP;
END $$;

-- Step 2: Populate profile_id in all financial tables

-- accounts
UPDATE accounts SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = accounts.user_id 
    AND pm.role = 'owner'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL;

-- transactions
UPDATE transactions SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = transactions.user_id 
    AND pm.role = 'owner'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL;

-- budgets
UPDATE budgets SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = budgets.user_id 
    AND pm.role = 'owner'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL;

-- budget_groups
UPDATE budget_groups SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = budget_groups.user_id 
    AND pm.role = 'owner'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL;

-- contacts
UPDATE contacts SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = contacts.user_id 
    AND pm.role = 'owner'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL;

-- credit_cards
UPDATE credit_cards SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = credit_cards.user_id 
    AND pm.role = 'owner'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL;

-- bills
UPDATE bills SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = bills.user_id 
    AND pm.role = 'owner'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL;

-- credit_scores
UPDATE credit_scores SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = credit_scores.user_id 
    AND pm.role = 'owner'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL;

-- plaid_items
UPDATE plaid_items SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = plaid_items.user_id 
    AND pm.role = 'owner'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL;

-- assets
UPDATE assets SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = assets.user_id 
    AND pm.role = 'owner'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL;

-- liabilities
UPDATE liabilities SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = liabilities.user_id 
    AND pm.role = 'owner'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL;

-- equity
UPDATE equity SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = equity.user_id 
    AND pm.role = 'owner'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL;

-- asset_liability_links
UPDATE asset_liability_links SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = asset_liability_links.user_id 
    AND pm.role = 'owner'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL;

-- user_chart_of_accounts
UPDATE user_chart_of_accounts SET profile_id = (
  SELECT p.id FROM profiles p
  INNER JOIN profile_memberships pm ON pm.profile_id = p.id
  WHERE pm.user_id = user_chart_of_accounts.user_id 
    AND pm.role = 'owner'
    AND p.is_deleted = false
  LIMIT 1
)
WHERE profile_id IS NULL;
