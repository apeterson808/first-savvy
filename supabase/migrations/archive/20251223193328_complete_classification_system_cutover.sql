/*
  # Complete Classification System Cutover - Data Reset

  1. Purpose
    - Complete migration to classification-only system
    - Remove all legacy account type and detail type references
    - Wipe all user financial data for clean slate
    - Preserve account classification templates (89 system templates)
    - Preserve user authentication and profile data

  2. Data Cleanup
    - DELETE all transactions
    - DELETE all budgets and budget_groups
    - DELETE all accounts, assets, liabilities, equity records
    - DELETE all categories (replaced by classifications)
    - KEEP account_classification_templates (system data)
    - KEEP account_classifications (user customizations)
    - KEEP user_profiles and auth data

  3. Schema Changes
    - Add account_classification_id to transactions (replaces category_id)
    - Make account_classification_id NOT NULL on all tables
    - Remove old category_id columns
    - Add constraints for proper classification references
    - Drop categories table (replaced by classifications)

  4. Important Notes
    - This is a breaking change requiring complete data reset
    - Users will start with blank slate and guided onboarding
    - All future data uses classification system exclusively
    - No rollback possible after this migration
*/

-- Step 1: Delete all user financial data (preserve auth and profiles)
DO $$
BEGIN
  -- Delete transactions first (has foreign keys to accounts and categories)
  DELETE FROM transactions;
  RAISE NOTICE 'Deleted all transactions';

  -- Delete budgets and budget groups
  DELETE FROM budgets;
  DELETE FROM budget_groups;
  RAISE NOTICE 'Deleted all budgets and budget groups';

  -- Delete asset-liability links if exists
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'asset_liability_links') THEN
    DELETE FROM asset_liability_links;
    RAISE NOTICE 'Deleted all asset-liability links';
  END IF;

  -- Delete all account-related records
  DELETE FROM credit_cards;
  DELETE FROM equity;
  DELETE FROM liabilities;
  DELETE FROM assets;
  DELETE FROM accounts;
  RAISE NOTICE 'Deleted all accounts, assets, liabilities, equity, and related records';

  -- Delete categories (replaced by classifications)
  DELETE FROM categories;
  RAISE NOTICE 'Deleted all categories';

  -- Delete bills
  DELETE FROM bills;
  RAISE NOTICE 'Deleted all bills';

END $$;

-- Step 2: Add account_classification_id to transactions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'account_classification_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN account_classification_id uuid REFERENCES account_classifications(id);
    CREATE INDEX IF NOT EXISTS idx_transactions_account_classification_id ON transactions(account_classification_id);
    RAISE NOTICE 'Added account_classification_id to transactions';
  END IF;
END $$;

-- Step 3: Drop category_id from transactions (replaced by account_classification_id)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'category_id'
  ) THEN
    -- Drop the index first
    DROP INDEX IF EXISTS idx_transactions_category_id;
    -- Drop the foreign key constraint
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_category_id_fkey;
    -- Drop the column
    ALTER TABLE transactions DROP COLUMN category_id;
    RAISE NOTICE 'Dropped category_id from transactions';
  END IF;
  
  -- Also drop ai_suggested_category_id
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'ai_suggested_category_id'
  ) THEN
    DROP INDEX IF EXISTS idx_transactions_ai_suggested_category_id;
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_ai_suggested_category_id_fkey;
    ALTER TABLE transactions DROP COLUMN ai_suggested_category_id;
    RAISE NOTICE 'Dropped ai_suggested_category_id from transactions';
  END IF;
END $$;

-- Step 4: Add constraint to ensure proper classification for income/expense transactions
DO $$
BEGIN
  -- Drop existing constraint if it exists
  ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_classification_type_check;
  
  -- Add new constraint
  ALTER TABLE transactions ADD CONSTRAINT transactions_classification_type_check CHECK (
    (type IN ('income', 'expense') AND account_classification_id IS NOT NULL) OR
    (type = 'transfer')
  );
  RAISE NOTICE 'Added classification type constraint to transactions';
END $$;

-- Step 5: Update budgets to use account_classification_id instead of category_id
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'account_classification_id'
  ) THEN
    ALTER TABLE budgets ADD COLUMN account_classification_id uuid REFERENCES account_classifications(id);
    CREATE INDEX IF NOT EXISTS idx_budgets_account_classification_id ON budgets(account_classification_id);
    RAISE NOTICE 'Added account_classification_id to budgets';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'category_id'
  ) THEN
    DROP INDEX IF EXISTS idx_budgets_category_id;
    ALTER TABLE budgets DROP CONSTRAINT IF EXISTS budgets_category_id_fkey;
    ALTER TABLE budgets DROP COLUMN category_id;
    RAISE NOTICE 'Dropped category_id from budgets';
  END IF;
END $$;

-- Step 6: Make account_classification_id NOT NULL on all account tables
DO $$
BEGIN
  -- For accounts table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'accounts' AND column_name = 'account_classification_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE accounts ALTER COLUMN account_classification_id SET NOT NULL;
    RAISE NOTICE 'Made account_classification_id NOT NULL on accounts';
  END IF;

  -- For assets table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'account_classification_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE assets ALTER COLUMN account_classification_id SET NOT NULL;
    RAISE NOTICE 'Made account_classification_id NOT NULL on assets';
  END IF;

  -- For liabilities table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'liabilities' AND column_name = 'account_classification_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE liabilities ALTER COLUMN account_classification_id SET NOT NULL;
    RAISE NOTICE 'Made account_classification_id NOT NULL on liabilities';
  END IF;

  -- For equity table
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'equity' AND column_name = 'account_classification_id' AND is_nullable = 'YES'
  ) THEN
    ALTER TABLE equity ALTER COLUMN account_classification_id SET NOT NULL;
    RAISE NOTICE 'Made account_classification_id NOT NULL on equity';
  END IF;
END $$;

-- Step 7: Drop foreign keys from contacts to categories
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'contacts' AND column_name = 'default_category_id'
  ) THEN
    ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_default_category_id_fkey;
    ALTER TABLE contacts DROP COLUMN default_category_id;
    RAISE NOTICE 'Dropped default_category_id from contacts';
  END IF;
END $$;

-- Step 8: Drop categories table (no longer needed)
DO $$
BEGIN
  DROP TABLE IF EXISTS categories CASCADE;
  RAISE NOTICE 'Dropped categories table';
END $$;

-- Step 9: Add helpful comments
DO $$
BEGIN
  EXECUTE 'COMMENT ON TABLE account_classification_templates IS ''Master list of 89 account classifications organized by class (asset, liability, equity, income, expense) and type. This is the single source of truth for all account types and categories in the system.''';

  EXECUTE 'COMMENT ON TABLE account_classifications IS ''User-specific instances of classifications from templates. Users can customize display_name, color, and icon while maintaining the base classification structure.''';
  
  RAISE NOTICE 'Added table comments';
END $$;

-- Step 10: Create function to auto-provision classifications for new users
CREATE OR REPLACE FUNCTION provision_user_classifications()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert all account classification templates for the new user
  INSERT INTO account_classifications (
    user_id,
    template_id,
    class,
    type,
    category,
    display_name,
    is_custom,
    is_active
  )
  SELECT
    NEW.id,
    id,
    class,
    type,
    category,
    category, -- display_name defaults to category
    false, -- not custom, copied from template
    true
  FROM account_classification_templates
  WHERE is_active = true;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-provision classifications on user creation
DROP TRIGGER IF EXISTS trigger_provision_user_classifications ON user_profiles;
CREATE TRIGGER trigger_provision_user_classifications
  AFTER INSERT ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION provision_user_classifications();

-- Step 11: Grant proper permissions
GRANT SELECT ON account_classification_templates TO authenticated;
GRANT ALL ON account_classifications TO authenticated;

-- Step 12: Add icon and color to account_classifications if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'account_classifications' AND column_name = 'icon'
  ) THEN
    ALTER TABLE account_classifications ADD COLUMN icon text;
    RAISE NOTICE 'Added icon column to account_classifications';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'account_classifications' AND column_name = 'color'
  ) THEN
    ALTER TABLE account_classifications ADD COLUMN color text DEFAULT '#6B7280';
    RAISE NOTICE 'Added color column to account_classifications';
  END IF;
END $$;

-- Step 13: Add icon and color to templates if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'account_classification_templates' AND column_name = 'icon'
  ) THEN
    ALTER TABLE account_classification_templates ADD COLUMN icon text DEFAULT 'Circle';
    RAISE NOTICE 'Added icon column to account_classification_templates';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'account_classification_templates' AND column_name = 'color'
  ) THEN
    ALTER TABLE account_classification_templates ADD COLUMN color text DEFAULT '#6B7280';
    RAISE NOTICE 'Added color column to account_classification_templates';
  END IF;
END $$;

-- Final summary
DO $$
BEGIN
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Classification System Cutover Complete!';
  RAISE NOTICE '================================================';
  RAISE NOTICE 'Users will start with blank slate';
  RAISE NOTICE '89 account classifications ready to use';
  RAISE NOTICE 'All accounts must reference account_classification_id';
  RAISE NOTICE 'Transactions use account_classification_id for categorization';
  RAISE NOTICE 'Budgets use account_classification_id for tracking';
  RAISE NOTICE '================================================';
END $$;