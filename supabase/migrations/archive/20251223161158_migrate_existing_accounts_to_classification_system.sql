/*
  # Migrate Existing Accounts to Classification System

  ## Overview
  This migration provisions account classifications for all existing users and maps
  their existing accounts, assets, liabilities, and equity records to the new
  classification system.

  ## Migration Steps

  ### 1. Provision Classifications for Existing Users
  - Identify all users who don't have account classifications yet
  - Call copy_account_classification_templates_to_user() for each user

  ### 2. Migrate Accounts Table
  - Map account_type values to appropriate classifications
  - Update account_classification_id for all matching records

  ### 3. Migrate Assets Table
  - Map detail_type values to appropriate classifications
  - Update account_classification_id for all matching records

  ### 4. Migrate Liabilities Table
  - Map detail_type values to appropriate classifications
  - Update account_classification_id for all matching records

  ### 5. Migrate Equity Table
  - Map detail_type values to appropriate classifications
  - Update account_classification_id for all matching records

  ## Notes
  - Uses existing account_type and detail_type columns for mapping
  - Does not delete old columns (kept for backward compatibility)
  - Logs migration progress via RAISE NOTICE
*/

-- ============================================================================
-- STEP 1: Provision Classifications for Existing Users
-- ============================================================================

DO $$
DECLARE
  user_record RECORD;
  classifications_created integer;
  total_users integer := 0;
  total_classifications integer := 0;
BEGIN
  -- Loop through all users who don't have account classifications yet
  FOR user_record IN 
    SELECT DISTINCT u.id
    FROM auth.users u
    WHERE NOT EXISTS (
      SELECT 1 FROM account_classifications ac WHERE ac.user_id = u.id
    )
  LOOP
    -- Provision classifications for this user
    classifications_created := copy_account_classification_templates_to_user(user_record.id);
    total_users := total_users + 1;
    total_classifications := total_classifications + classifications_created;
  END LOOP;

  IF total_users > 0 THEN
    RAISE NOTICE 'Provisioned % classifications for % existing users', 
      total_classifications, total_users;
  ELSE
    RAISE NOTICE 'All existing users already have account classifications';
  END IF;
END $$;

-- ============================================================================
-- STEP 2: Migrate Accounts Table
-- ============================================================================

DO $$
DECLARE
  updated_count integer;
BEGIN
  -- Map checking accounts
  UPDATE accounts a
  SET account_classification_id = ac.id
  FROM account_classifications ac
  WHERE a.user_id = ac.user_id
    AND a.account_type = 'checking'
    AND ac.class = 'asset'
    AND ac.type = 'bank accounts'
    AND ac.category = 'checking'
    AND a.account_classification_id IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % checking accounts', updated_count;

  -- Map savings accounts
  UPDATE accounts a
  SET account_classification_id = ac.id
  FROM account_classifications ac
  WHERE a.user_id = ac.user_id
    AND a.account_type = 'savings'
    AND ac.class = 'asset'
    AND ac.type = 'bank accounts'
    AND ac.category = 'savings'
    AND a.account_classification_id IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % savings accounts', updated_count;

  -- Map credit card accounts
  UPDATE accounts a
  SET account_classification_id = ac.id
  FROM account_classifications ac
  WHERE a.user_id = ac.user_id
    AND a.account_type = 'credit_card'
    AND ac.class = 'liability'
    AND ac.type = 'credit card'
    AND ac.category = 'personal credit card'
    AND a.account_classification_id IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % credit card accounts', updated_count;

  -- Map investment accounts
  UPDATE accounts a
  SET account_classification_id = ac.id
  FROM account_classifications ac
  WHERE a.user_id = ac.user_id
    AND a.account_type = 'investment'
    AND ac.class = 'asset'
    AND ac.type = 'investments'
    AND ac.category = 'brokerage'
    AND a.account_classification_id IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % investment accounts', updated_count;

  -- Map cash accounts
  UPDATE accounts a
  SET account_classification_id = ac.id
  FROM account_classifications ac
  WHERE a.user_id = ac.user_id
    AND a.account_type = 'cash'
    AND ac.class = 'asset'
    AND ac.type = 'cash'
    AND ac.category = 'physical cash'
    AND a.account_classification_id IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % cash accounts', updated_count;

  -- Map loan accounts
  UPDATE accounts a
  SET account_classification_id = ac.id
  FROM account_classifications ac
  WHERE a.user_id = ac.user_id
    AND a.account_type = 'loan'
    AND ac.class = 'liability'
    AND ac.type = 'loans & debt'
    AND ac.category = 'personal loan'
    AND a.account_classification_id IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % loan accounts', updated_count;
END $$;

-- ============================================================================
-- STEP 3: Migrate Assets Table
-- ============================================================================

DO $$
DECLARE
  updated_count integer;
BEGIN
  -- Map vehicle assets
  UPDATE assets a
  SET account_classification_id = ac.id
  FROM account_classifications ac
  WHERE a.user_id = ac.user_id
    AND a.detail_type = 'vehicle'
    AND ac.class = 'asset'
    AND ac.type = 'vehicle'
    AND ac.category = 'personal vehicle'
    AND a.account_classification_id IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % vehicle assets', updated_count;

  -- Map property assets
  UPDATE assets a
  SET account_classification_id = ac.id
  FROM account_classifications ac
  WHERE a.user_id = ac.user_id
    AND a.detail_type = 'property'
    AND ac.class = 'asset'
    AND ac.type = 'real estate'
    AND ac.category = 'primary residence'
    AND a.account_classification_id IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % property assets', updated_count;

  -- Map investment assets
  UPDATE assets a
  SET account_classification_id = ac.id
  FROM account_classifications ac
  WHERE a.user_id = ac.user_id
    AND a.detail_type IN ('stocks', 'investment', 'brokerage')
    AND ac.class = 'asset'
    AND ac.type = 'investments'
    AND ac.category = 'brokerage'
    AND a.account_classification_id IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % investment assets', updated_count;

  -- Map cash assets
  UPDATE assets a
  SET account_classification_id = ac.id
  FROM account_classifications ac
  WHERE a.user_id = ac.user_id
    AND a.detail_type IN ('cash', 'savings', 'checking')
    AND ac.class = 'asset'
    AND ac.type = 'cash'
    AND ac.category = 'physical cash'
    AND a.account_classification_id IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % cash assets', updated_count;
END $$;

-- ============================================================================
-- STEP 4: Migrate Liabilities Table
-- ============================================================================

DO $$
DECLARE
  updated_count integer;
BEGIN
  -- Map auto loan liabilities
  UPDATE liabilities l
  SET account_classification_id = ac.id
  FROM account_classifications ac
  WHERE l.user_id = ac.user_id
    AND l.detail_type = 'auto_loan'
    AND ac.class = 'liability'
    AND ac.type = 'loans & debt'
    AND ac.category = 'auto loan'
    AND l.account_classification_id IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % auto loan liabilities', updated_count;

  -- Map mortgage liabilities
  UPDATE liabilities l
  SET account_classification_id = ac.id
  FROM account_classifications ac
  WHERE l.user_id = ac.user_id
    AND l.detail_type = 'mortgage'
    AND ac.class = 'liability'
    AND ac.type = 'loans & debt'
    AND ac.category = 'mortgage primary'
    AND l.account_classification_id IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % mortgage liabilities', updated_count;

  -- Map credit card liabilities
  UPDATE liabilities l
  SET account_classification_id = ac.id
  FROM account_classifications ac
  WHERE l.user_id = ac.user_id
    AND l.detail_type = 'credit_card'
    AND ac.class = 'liability'
    AND ac.type = 'credit card'
    AND ac.category = 'personal credit card'
    AND l.account_classification_id IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % credit card liabilities', updated_count;

  -- Map personal loan liabilities
  UPDATE liabilities l
  SET account_classification_id = ac.id
  FROM account_classifications ac
  WHERE l.user_id = ac.user_id
    AND l.detail_type = 'personal_loan'
    AND ac.class = 'liability'
    AND ac.type = 'loans & debt'
    AND ac.category = 'personal loan'
    AND l.account_classification_id IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % personal loan liabilities', updated_count;

  -- Map student loan liabilities
  UPDATE liabilities l
  SET account_classification_id = ac.id
  FROM account_classifications ac
  WHERE l.user_id = ac.user_id
    AND l.detail_type = 'student_loan'
    AND ac.class = 'liability'
    AND ac.type = 'loans & debt'
    AND ac.category = 'student loan'
    AND l.account_classification_id IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % student loan liabilities', updated_count;
END $$;

-- ============================================================================
-- STEP 5: Migrate Equity Table
-- ============================================================================

DO $$
DECLARE
  updated_count integer;
BEGIN
  -- Map opening balance equity
  UPDATE equity e
  SET account_classification_id = ac.id
  FROM account_classifications ac
  WHERE e.user_id = ac.user_id
    AND e.detail_type IN ('opening_balance_equity', 'personal_equity')
    AND ac.class = 'equity'
    AND ac.type = 'equity adjustments'
    AND ac.category = 'opening balance equity'
    AND e.account_classification_id IS NULL;
  
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % equity records', updated_count;
END $$;

-- ============================================================================
-- SUMMARY
-- ============================================================================

DO $$
DECLARE
  total_migrated integer;
BEGIN
  -- Count total records with classifications
  SELECT 
    (SELECT COUNT(*) FROM accounts WHERE account_classification_id IS NOT NULL) +
    (SELECT COUNT(*) FROM assets WHERE account_classification_id IS NOT NULL) +
    (SELECT COUNT(*) FROM liabilities WHERE account_classification_id IS NOT NULL) +
    (SELECT COUNT(*) FROM equity WHERE account_classification_id IS NOT NULL)
  INTO total_migrated;
  
  RAISE NOTICE 'Migration complete. Total records with classifications: %', total_migrated;
END $$;
