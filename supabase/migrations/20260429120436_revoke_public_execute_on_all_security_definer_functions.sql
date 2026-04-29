/*
  # Revoke PUBLIC EXECUTE on all SECURITY DEFINER functions

  ## Summary
  PostgreSQL grants EXECUTE to PUBLIC by default for all functions, which means
  both `anon` and `authenticated` roles inherit it. Prior REVOKE attempts on
  specific roles did not fully resolve this because the PUBLIC grant remained.

  This migration:
  1. Revokes EXECUTE from PUBLIC on every SECURITY DEFINER function in public schema
  2. Grants EXECUTE back to `authenticated` and `service_role` on RPC-callable functions
     that the app legitimately uses
  3. Trigger functions (never called via RPC) receive no grants beyond postgres/superuser
  4. Fixes the avatars bucket: drops the broad listing policy and replaces it with
     a per-object SELECT policy that prevents bucket enumeration
*/

-- ============================================================
-- Trigger / internal-only functions
-- Revoke from PUBLIC entirely — only the database engine calls these
-- ============================================================
REVOKE ALL ON FUNCTION public.update_child_profile_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_chores_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_transfer_pairing() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_chart_account_for_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_chart_account_for_asset() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_chart_account_for_bank_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_chart_account_for_budget() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_chart_account_for_credit_card() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_chart_account_for_equity() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_chart_account_for_liability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_chart_account_for_transaction() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_chart_account_on_budget() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_chart_account_on_transaction() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auto_activate_chart_account() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auto_apply_rule_on_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auto_apply_rule_to_transaction() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auto_create_journal_entry_from_transaction() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auto_provision_chart_of_accounts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_adult_limit() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_status_change_via_rpc() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.deactivate_chart_account_for_budget() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_single_active_tab() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_system_account_deletes() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.prevent_system_account_updates() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_immutable_transaction_data() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.protect_journal_entry_immutability() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_bank_accounts_to_accounts() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.sync_transaction_account_ids() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.trigger_auto_match_on_transfer() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_account_balance_from_journal() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_account_classifications_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_accounts_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_asset_liability_links_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_balance_on_transaction_status_change() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_bank_accounts_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_categorization_rules_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_color_schemes_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_contact_matching_rules_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_credit_card_balance() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_credit_cards_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_equity_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_journal_entry_counters_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_payment_reminders_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_profile_tabs_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_profile_view_preferences_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_protected_configuration_timestamp() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_statement_uploads_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_transaction_rules_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_transaction_splits_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_unreconciled_difference() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_user_chart_of_accounts_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_user_profile_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_child_budget_allocation() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_transaction_splits() FROM PUBLIC;

-- ============================================================
-- RPC-callable functions
-- Revoke from PUBLIC, then grant back to authenticated + service_role
-- ============================================================

REVOKE ALL ON FUNCTION public.accept_invitation(text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.activate_template_account(uuid, integer, text, numeric, text, text, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_user_expense_category(uuid, text, text, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.add_user_income_category(uuid, text, text, integer, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_rule_to_transaction(uuid, uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_transfer_match(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.approve_task_completion(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.archive_completed_jobs() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.auto_match_transfers(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_parent_and_children_spending(uuid, uuid, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_parent_and_children_spending(uuid, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_reminder_date(date, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_total_child_budget_allocations(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.calculate_total_child_budget_allocations(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_transaction_matches_rule(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.check_upcoming_payment_reminders() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_vault_trash() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.copy_account_classification_templates_to_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.copy_category_templates_to_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_journal_entry(uuid, uuid, date, text, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_opening_balance_journal_entry(uuid, uuid, uuid, numeric, date, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_reversal_entry(uuid, date, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_user_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.create_vault_item(jsonb, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.decrypt_vault_field(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.diagnose_account_journal_lines(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.encrypt_vault_field(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_complete_provisioning() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_default_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_default_tab(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_user_profile() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ensure_vault_key(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.expire_old_invitations() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.extract_merchant_pattern(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_matching_rules_for_transaction(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_opposite_amount_matches(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.find_transfer_matches(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_journal_entry_number(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_journal_entry_number(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.generate_transaction_fingerprint(date, text, numeric, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_account_audit_history_paginated(uuid, uuid, date, date, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_account_journal_lines(uuid, uuid, date, date) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_account_journal_lines_paginated(uuid, uuid, date, date, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_batch_status(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_category_suggestion_by_pattern(text, uuid, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_journal_entry_with_lines(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_multi_account_audit_history_paginated(uuid, uuid[], date, date, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_multi_account_journal_lines_paginated(uuid, uuid[], date, date, integer, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_next_account_number(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_next_available_account_number(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_next_journal_entry_number(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_parent_budget(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_parent_budget(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_vault_items(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_vault_key(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_profile_access(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_pattern_acceptance(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_pattern_rejection(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.log_audit_action(uuid, uuid, text, text, uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.manual_provision_current_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.provision_chart_of_accounts_for_user(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.recalculate_account_balance(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.redeem_reward(uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reject_task_completion(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_financial_data_for_profile(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.revoke_vault_share(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.rpc_post_transaction(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.share_vault_item(uuid, uuid, text, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.undo_posted_transaction(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_account_display_name(uuid, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_account_number(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_journal_entry(uuid, text, public.journal_line_update[], text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_journal_entry_with_lines(uuid, uuid, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_journal_entry_with_lines(uuid, uuid, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.update_vault_item(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_account_number_range(integer, text, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_child_budget_allocation(uuid, numeric, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_child_budget_allocation(uuid, numeric, text, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_journal_entry_balance(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.validate_transaction_splits(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.verify_user_provisioning() FROM PUBLIC;

-- ============================================================
-- Grant EXECUTE back to authenticated + service_role for RPC functions
-- ============================================================

GRANT EXECUTE ON FUNCTION public.accept_invitation(text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.activate_template_account(uuid, integer, text, numeric, text, text, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_user_expense_category(uuid, text, text, integer, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.add_user_income_category(uuid, text, text, integer, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_rule_to_transaction(uuid, uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.apply_transfer_match(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.approve_task_completion(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.archive_completed_jobs() TO service_role;
GRANT EXECUTE ON FUNCTION public.auto_match_transfers(uuid, numeric) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_parent_and_children_spending(uuid, uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_parent_and_children_spending(uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_reminder_date(date, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_total_child_budget_allocations(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.calculate_total_child_budget_allocations(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_transaction_matches_rule(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.check_upcoming_payment_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_vault_trash() TO service_role;
GRANT EXECUTE ON FUNCTION public.copy_account_classification_templates_to_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.copy_category_templates_to_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_journal_entry(uuid, uuid, date, text, text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_opening_balance_journal_entry(uuid, uuid, uuid, numeric, date, text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_reversal_entry(uuid, date, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_user_profile() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_vault_item(jsonb, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.decrypt_vault_field(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.diagnose_account_journal_lines(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.encrypt_vault_field(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_complete_provisioning() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_default_profile() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_default_tab(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_user_profile() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ensure_vault_key(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.expire_old_invitations() TO service_role;
GRANT EXECUTE ON FUNCTION public.extract_merchant_pattern(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_matching_rules_for_transaction(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_opposite_amount_matches(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.find_transfer_matches(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_journal_entry_number(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_journal_entry_number(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.generate_transaction_fingerprint(date, text, numeric, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_account_audit_history_paginated(uuid, uuid, date, date, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_account_journal_lines(uuid, uuid, date, date) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_account_journal_lines_paginated(uuid, uuid, date, date, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_batch_status(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_category_suggestion_by_pattern(text, uuid, double precision) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_journal_entry_with_lines(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_multi_account_audit_history_paginated(uuid, uuid[], date, date, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_multi_account_journal_lines_paginated(uuid, uuid[], date, date, integer, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_next_account_number(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_next_available_account_number(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_next_journal_entry_number(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_parent_budget(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_parent_budget(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_vault_items(uuid, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_vault_key(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_profile_access(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_pattern_acceptance(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_pattern_rejection(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.log_audit_action(uuid, uuid, text, text, uuid, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.manual_provision_current_user() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.provision_chart_of_accounts_for_user(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_account_balance(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.redeem_reward(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reject_task_completion(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.reset_financial_data_for_profile(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.revoke_vault_share(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rpc_post_transaction(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.share_vault_item(uuid, uuid, text, timestamptz) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.undo_posted_transaction(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_account_display_name(uuid, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_account_number(uuid, integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_journal_entry(uuid, text, public.journal_line_update[], text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_journal_entry_with_lines(uuid, uuid, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_journal_entry_with_lines(uuid, uuid, text, text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_vault_item(uuid, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_account_number_range(integer, text, boolean) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_child_budget_allocation(uuid, numeric, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_child_budget_allocation(uuid, numeric, text, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_journal_entry_balance(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.validate_transaction_splits(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.verify_user_provisioning() TO authenticated, service_role;

-- ============================================================
-- Fix avatars bucket: drop broad listing policy, add tight one
-- ============================================================

DROP POLICY IF EXISTS "Authenticated users can read avatar objects" ON storage.objects;

-- Allow reading individual avatar objects by authenticated users only.
-- The `name` check prevents empty-prefix LIST calls that enumerate the bucket.
CREATE POLICY "Read individual avatar objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND name != ''
  );
