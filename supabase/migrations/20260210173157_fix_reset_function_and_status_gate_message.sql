/*
  # Fix reset financial data function and status gate trigger message

  1. Changes
    - `reset_financial_data_for_profile`: Sets the `app.internal_status_write`
      session flag before updating transaction statuses, so the status gate
      trigger allows the operation through
    - `check_status_change_via_rpc`: Updated error message to remove reference
      to the removed `undoPostTransaction()` function
    - Simplified the reset: just delete transactions directly instead of
      setting to pending first (the journal entries/lines will be cleaned up
      by subsequent deletes anyway)

  2. Context
    - The status gate trigger was blocking the reset function from changing
      transaction statuses from 'posted' to 'pending' before deletion
    - The undo/reversal system was removed, so the error message was outdated
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

  DELETE FROM user_chart_of_accounts 
  WHERE profile_id = p_profile_id 
    AND is_user_created = false;
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  RAISE NOTICE 'Deleted % template accounts', v_deleted_count;

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

CREATE OR REPLACE FUNCTION check_status_change_via_rpc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session_flag TEXT;
  v_current_role TEXT;
BEGIN
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  v_session_flag := current_setting('app.internal_status_write', true);
  v_current_role := current_role;

  IF v_session_flag = 'true' OR v_current_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Direct status updates not allowed. Use transactionService.postTransaction() to change transaction status.';
END;
$$;
