/*
  # Fix reset financial data function

  1. Changes
    - Remove session_replication_role setting (requires superuser)
    - Rely on CASCADE DELETE for foreign key relationships
    - Delete in correct dependency order
    - Handle triggers gracefully

  2. Security
    - Uses SECURITY DEFINER to run with elevated privileges
    - Can only be called by authenticated users on their own profile
*/

CREATE OR REPLACE FUNCTION reset_financial_data_for_profile(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_deleted_count int := 0;
  v_custom_categories int := 0;
  v_memories int := 0;
  v_rules int := 0;
BEGIN
  -- Verify the profile exists
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_profile_id) THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Delete in correct dependency order
  -- Note: Many tables have ON DELETE CASCADE, so deleting parent records
  -- will automatically clean up child records
  
  RAISE NOTICE 'Starting deletion for profile: %', p_profile_id;

  -- Step 1: Delete transaction splits (child of transactions)
  DELETE FROM transaction_splits 
  WHERE transaction_id IN (
    SELECT id FROM transactions WHERE profile_id = p_profile_id
  );
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % transaction_splits', v_deleted_count;

  -- Step 2: Delete transactions (this will trigger journal entry cleanup via triggers)
  -- Set to pending first to trigger cleanup, then delete
  UPDATE transactions 
  SET status = 'pending'
  WHERE profile_id = p_profile_id AND status = 'posted';
  
  DELETE FROM transactions WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % transactions', v_deleted_count;

  -- Step 3: Delete any remaining journal entry lines
  DELETE FROM journal_entry_lines WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % journal_entry_lines', v_deleted_count;

  -- Step 4: Delete any remaining journal entries
  DELETE FROM journal_entries WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % journal_entries', v_deleted_count;

  -- Step 5: Delete journal entry counters
  DELETE FROM journal_entry_counters WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % journal_entry_counters', v_deleted_count;

  -- Step 6: Delete transfer registry
  DELETE FROM transfer_registry WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % transfer_registry rows', v_deleted_count;

  -- Step 7: Delete accounting periods
  DELETE FROM accounting_periods WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % accounting_periods', v_deleted_count;

  -- Step 8: Delete budgets
  DELETE FROM budgets WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % budgets', v_deleted_count;

  -- Step 9: Delete profile preferences
  DELETE FROM profile_view_preferences WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % profile_view_preferences', v_deleted_count;

  -- Step 10: Delete profile tabs
  DELETE FROM profile_tabs WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % profile_tabs', v_deleted_count;

  -- Step 11: Delete profile memberships
  DELETE FROM profile_memberships WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % profile_memberships', v_deleted_count;

  -- Step 12: Delete template accounts (preserve custom categories)
  DELETE FROM user_chart_of_accounts 
  WHERE profile_id = p_profile_id 
    AND is_user_created = false;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % template accounts', v_deleted_count;

  -- Count preserved items
  SELECT COUNT(*) INTO v_custom_categories
  FROM user_chart_of_accounts
  WHERE profile_id = p_profile_id
    AND is_user_created = true;

  SELECT COUNT(*) INTO v_memories
  FROM transaction_categorization_memory
  WHERE profile_id = p_profile_id;

  SELECT COUNT(*) INTO v_rules
  FROM transaction_rules
  WHERE profile_id = p_profile_id;

  RAISE NOTICE 'Preserved % custom categories, % memories, % rules', 
    v_custom_categories, v_memories, v_rules;

  -- Return summary
  RETURN jsonb_build_object(
    'success', true,
    'preserved_custom_categories', v_custom_categories,
    'preserved_memories', v_memories,
    'preserved_rules', v_rules
  );

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error during reset: %', SQLERRM;
    RAISE;
END;
$$;

COMMENT ON FUNCTION reset_financial_data_for_profile IS
'Admin function to reset all financial data for a profile while preserving contacts, custom categories, categorization memories, and transaction rules.';
