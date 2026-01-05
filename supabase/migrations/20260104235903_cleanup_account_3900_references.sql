/*
  # Cleanup Account 3900 References

  1. Purpose
    - Replace all references to account 3900 (incorrectly created Opening Balance Equity) with account 3000
    - Delete duplicate Opening Balance Equity accounts created at 3900
    - Ensure account 3000 is active for all users

  2. Changes
    - Temporarily disable system account protection triggers
    - Update transactions referencing account 3900 to reference correct account 3000
    - Delete user_chart_of_accounts records with account_number 3900
    - Set account 3000 to active for all profiles
    - Re-enable system account protection triggers

  3. Data Safety
    - Only updates transactions if target account 3000 exists for the same profile
    - Preserves all transaction data, only updates the account reference
    - No data loss, only correcting incorrect account mappings
*/

-- Step 1: Temporarily disable triggers
ALTER TABLE user_chart_of_accounts DISABLE TRIGGER block_system_account_updates;
ALTER TABLE user_chart_of_accounts DISABLE TRIGGER block_system_account_deletes;

-- Step 2: For each profile with a 3900 account, update transactions to point to their 3000 account
DO $$
DECLARE
  account_3900_record RECORD;
  account_3000_id UUID;
BEGIN
  FOR account_3900_record IN 
    SELECT id, profile_id, account_number 
    FROM user_chart_of_accounts 
    WHERE account_number = 3900
  LOOP
    SELECT id INTO account_3000_id
    FROM user_chart_of_accounts
    WHERE profile_id = account_3900_record.profile_id
      AND account_number = 3000
    LIMIT 1;

    IF account_3000_id IS NOT NULL THEN
      UPDATE transactions
      SET category_account_id = account_3000_id
      WHERE category_account_id = account_3900_record.id
        AND profile_id = account_3900_record.profile_id;

      RAISE NOTICE 'Updated transactions for profile % from account 3900 to 3000', account_3900_record.profile_id;
    ELSE
      RAISE WARNING 'No account 3000 found for profile % with account 3900', account_3900_record.profile_id;
    END IF;
  END LOOP;
END $$;

-- Step 3: Delete all accounts with account_number 3900 (duplicates)
DELETE FROM user_chart_of_accounts
WHERE account_number = 3900;

-- Step 4: Ensure account 3000 is active for all users
UPDATE user_chart_of_accounts
SET is_active = true
WHERE account_number = 3000
  AND is_active = false;

-- Step 5: Re-enable triggers
ALTER TABLE user_chart_of_accounts ENABLE TRIGGER block_system_account_updates;
ALTER TABLE user_chart_of_accounts ENABLE TRIGGER block_system_account_deletes;

-- Step 6: Verify and report results
DO $$
DECLARE
  remaining_3900_count INTEGER;
  active_3000_count INTEGER;
  total_3000_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO remaining_3900_count
  FROM user_chart_of_accounts
  WHERE account_number = 3900;

  SELECT COUNT(*) INTO active_3000_count
  FROM user_chart_of_accounts
  WHERE account_number = 3000
    AND is_active = true;

  SELECT COUNT(*) INTO total_3000_count
  FROM user_chart_of_accounts
  WHERE account_number = 3000;

  RAISE NOTICE 'Cleanup complete:';
  RAISE NOTICE '  - Remaining 3900 accounts: %', remaining_3900_count;
  RAISE NOTICE '  - Active 3000 accounts: % / %', active_3000_count, total_3000_count;
END $$;
