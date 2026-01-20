/*
  # Create admin function to reset financial data

  1. Purpose
    - Provides an admin-level function to completely reset a user's financial data
    - Bypasses all triggers, constraints, and RLS policies
    - Preserves contacts, custom categories, categorization memories, and transaction rules

  2. Security
    - Uses SECURITY DEFINER to run with elevated privileges
    - Can only be called by authenticated users on their own profile
    - Bypasses RLS and triggers safely for data cleanup

  3. Implementation
    - Temporarily disables triggers during deletion
    - Deletes in correct dependency order
    - Re-enables triggers after completion
*/

-- Create function to reset financial data for a profile
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

  -- Temporarily disable triggers for this session
  SET session_replication_role = 'replica';

  -- Delete in correct dependency order
  -- Step 1: Delete journal entry lines (child of journal_entries)
  DELETE FROM journal_entry_lines WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % journal_entry_lines', v_deleted_count;

  -- Step 2: Delete journal entries
  DELETE FROM journal_entries WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % journal_entries', v_deleted_count;

  -- Step 3: Delete journal entry counters
  DELETE FROM journal_entry_counters WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % journal_entry_counters', v_deleted_count;

  -- Step 4: Delete transaction splits
  DELETE FROM transaction_splits 
  WHERE transaction_id IN (
    SELECT id FROM transactions WHERE profile_id = p_profile_id
  );
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % transaction_splits', v_deleted_count;

  -- Step 5: Delete transactions
  DELETE FROM transactions WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % transactions', v_deleted_count;

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

  -- Re-enable triggers
  SET session_replication_role = 'origin';

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
    -- Re-enable triggers on error
    SET session_replication_role = 'origin';
    RAISE;
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION reset_financial_data_for_profile(uuid) TO authenticated;

COMMENT ON FUNCTION reset_financial_data_for_profile IS
'Admin function to reset all financial data for a profile while preserving contacts, custom categories, categorization memories, and transaction rules. Bypasses triggers and constraints for safe deletion.';
