/*
  # Fix Cleanup Script - Use profile_id Instead of user_id

  ## Problem
  The previous cleanup script tried to query user_chart_of_accounts by user_id,
  but that table only has profile_id column.

  ## Solution
  Re-run the cleanup using the correct profile_id column

  ## Impact
  - Existing incorrect opening balance entries will be corrected
  - Both lines will reference different accounts (asset/liability and equity)
*/

DO $$
DECLARE
  v_entry RECORD;
  v_line1 RECORD;
  v_line2 RECORD;
  v_equity_account_id uuid;
  v_affected_count integer := 0;
BEGIN
  RAISE NOTICE 'Starting cleanup of duplicate opening balance entries...';

  -- Loop through all opening balance journal entries
  FOR v_entry IN 
    SELECT id, profile_id, user_id, description
    FROM journal_entries
    WHERE entry_type = 'opening_balance'
    ORDER BY entry_date, entry_number
  LOOP
    -- Get the two lines for this entry
    SELECT * INTO v_line1
    FROM journal_entry_lines
    WHERE journal_entry_id = v_entry.id
    ORDER BY line_number
    LIMIT 1;

    SELECT * INTO v_line2
    FROM journal_entry_lines
    WHERE journal_entry_id = v_entry.id
    ORDER BY line_number DESC
    LIMIT 1;

    -- Check if both lines point to the same account (the bug)
    IF v_line1.account_id = v_line2.account_id THEN
      RAISE NOTICE 'Found duplicate entry: % (both lines point to account %)', 
        v_entry.description, v_line1.account_id;

      -- Get the Opening Balance Equity account for this profile (NOT user_id)
      SELECT id INTO v_equity_account_id
      FROM user_chart_of_accounts
      WHERE profile_id = v_entry.profile_id
      AND account_number = 3000
      LIMIT 1;

      IF v_equity_account_id IS NOT NULL THEN
        -- Update the second line to point to the equity account
        UPDATE journal_entry_lines
        SET 
          account_id = v_equity_account_id,
          description = 'Opening Balance Equity'
        WHERE id = v_line2.id;

        v_affected_count := v_affected_count + 1;
        RAISE NOTICE '  ✓ Fixed: Updated line 2 to use Opening Balance Equity account';
      ELSE
        RAISE WARNING '  ✗ Cannot fix: Opening Balance Equity account (3000) not found for profile %', 
          v_entry.profile_id;
      END IF;
    END IF;
  END LOOP;

  RAISE NOTICE 'Cleanup complete: Fixed % journal entries', v_affected_count;
END $$;
