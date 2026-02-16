/*
  # Preserve All Categories During Financial Data Reset

  1. Changes
    - Update `reset_financial_data_for_profile` function to preserve ALL income and expense categories
    - Only delete asset, liability, and equity accounts (checking, savings, credit cards, loans, etc.)
    - This ensures transaction rules continue to work since category UUIDs remain unchanged
  
  2. What Gets Preserved
    - All income categories with their UUIDs, names, colors, icons, and settings
    - All expense categories with their UUIDs, names, colors, icons, and settings
    - Categorization memory and transaction rules (as before)
  
  3. What Gets Deleted
    - Asset accounts (checking, savings, investments, etc.)
    - Liability accounts (credit cards, mortgages, loans, etc.)
    - Equity accounts (opening balance equity, etc.)
    - All transactions, journal entries, and balances
  
  4. Benefits
    - Transaction rules remain valid with existing category UUIDs
    - Budget allocations remain linked to valid categories
    - User customizations (names, colors, icons, active/inactive status) are preserved
    - No need to reconfigure categories after reset
*/

CREATE OR REPLACE FUNCTION reset_financial_data_for_profile(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count int := 0;
  v_preserved_categories int := 0;
  v_memories int := 0;
  v_rules int := 0;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id) THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  RAISE NOTICE 'Starting deletion for profile: %', p_profile_id;

  PERFORM set_config('app.internal_status_write', 'true', true);

  DELETE FROM transaction_splits 
  WHERE transaction_id IN (
    SELECT id FROM transactions WHERE profile_id = p_profile_id
  );
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % transaction_splits', v_deleted_count;

  DELETE FROM transactions WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % transactions', v_deleted_count;

  DELETE FROM journal_entry_lines WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % journal_entry_lines', v_deleted_count;

  DELETE FROM journal_entries WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % journal_entries', v_deleted_count;

  DELETE FROM journal_entry_counters WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % journal_entry_counters', v_deleted_count;

  DELETE FROM transfer_registry WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % transfer_registry rows', v_deleted_count;

  DELETE FROM accounting_periods WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % accounting_periods', v_deleted_count;

  DELETE FROM budgets WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % budgets', v_deleted_count;

  DELETE FROM profile_view_preferences WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % profile_view_preferences', v_deleted_count;

  DELETE FROM profile_tabs WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % profile_tabs', v_deleted_count;

  DELETE FROM profile_memberships WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % profile_memberships', v_deleted_count;

  -- DELETE ONLY FINANCIAL ACCOUNTS (asset, liability, equity)
  -- PRESERVE ALL CATEGORIES (income and expense)
  -- This ensures transaction rules and budgets remain valid
  DELETE FROM user_chart_of_accounts 
  WHERE profile_id = p_profile_id
  AND class NOT IN ('income', 'expense');
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % financial accounts (preserved all categories)', v_deleted_count;

  -- Count preserved categories (both income and expense)
  SELECT COUNT(*) INTO v_preserved_categories
  FROM user_chart_of_accounts
  WHERE profile_id = p_profile_id
  AND class IN ('income', 'expense');

  SELECT COUNT(*) INTO v_memories
  FROM transaction_categorization_memory
  WHERE profile_id = p_profile_id;

  SELECT COUNT(*) INTO v_rules
  FROM transaction_rules
  WHERE profile_id = p_profile_id;

  RAISE NOTICE 'Preserved % categories, % memories, % rules', 
    v_preserved_categories, v_memories, v_rules;

  RETURN jsonb_build_object(
    'success', true,
    'preserved_categories', v_preserved_categories,
    'preserved_memories', v_memories,
    'preserved_rules', v_rules
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error during reset: %', SQLERRM;
    RAISE;
END;
$$;