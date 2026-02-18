/*
  # Fix Reset Financial Data to Clean Up Detection Queue

  ## Changes
  
  Updates `reset_financial_data_for_profile` to also delete:
  - detection_jobs (queued/running detection jobs)
  - detection_jobs_archive (historical completed jobs)
  - transaction_processing_state (processing state tracker)
  
  This ensures the reset button works correctly and doesn't leave orphaned
  queue records that could cause issues during re-import.
  
  ## Why This is Needed
  
  The recent addition of the detection job queue system added new tables that
  track transaction processing state. When resetting financial data, these
  must also be cleaned up to ensure:
  
  1. No orphaned queue jobs pointing to deleted transactions
  2. Clean state for re-importing data
  3. No confusion about what's "already processed"
*/

-- Drop and recreate with full cleanup
DROP FUNCTION IF EXISTS reset_financial_data_for_profile(uuid);

CREATE FUNCTION reset_financial_data_for_profile(p_profile_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  -- NEW: Clean up detection queue system
  DELETE FROM detection_jobs WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % detection_jobs', v_deleted_count;

  DELETE FROM detection_jobs_archive WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % detection_jobs_archive', v_deleted_count;

  DELETE FROM transaction_processing_state 
  WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % transaction_processing_state', v_deleted_count;

  -- Clean up AI suggestions
  DELETE FROM ai_category_suggestions
  WHERE transaction_id IN (
    SELECT id FROM transactions WHERE profile_id = p_profile_id
  );
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % ai_category_suggestions', v_deleted_count;

  DELETE FROM ai_contact_suggestions
  WHERE transaction_id IN (
    SELECT id FROM transactions WHERE profile_id = p_profile_id
  );
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % ai_contact_suggestions', v_deleted_count;

  -- Clean up match history
  DELETE FROM transfer_match_history WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % transfer_match_history', v_deleted_count;

  DELETE FROM cc_payment_match_history WHERE profile_id = p_profile_id;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % cc_payment_match_history', v_deleted_count;

  -- Existing cleanup
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
  DELETE FROM user_chart_of_accounts 
  WHERE profile_id = p_profile_id
  AND class NOT IN ('income', 'expense');
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % financial accounts (preserved all categories)', v_deleted_count;

  -- Count preserved data
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION reset_financial_data_for_profile TO authenticated;
