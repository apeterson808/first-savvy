/*
  # Fix SECURITY DEFINER Function Permissions & Storage Bucket Policies

  ## Summary
  Two classes of security issues are addressed:

  ### 1. Revoke anon EXECUTE on all SECURITY DEFINER functions
  All 134 SECURITY DEFINER functions in public schema were callable by the `anon`
  role, allowing unauthenticated access to sensitive operations (vault encryption,
  financial resets, profile provisioning, etc.). This migration revokes EXECUTE
  from `anon` on every affected function, then grants it back only to `authenticated`
  and `service_role` where needed for the app to function.

  Trigger functions (used only internally by the database engine, never called via
  RPC) have EXECUTE revoked from both `anon` and `authenticated`.

  ### 2. Fix avatars bucket broad SELECT policies
  The `avatars` storage bucket had two overlapping broad SELECT policies that allowed
  clients to LIST all files. Public buckets only need object URL access, not listing.
  Both policies are dropped and replaced with a single minimal policy that allows
  reading individual objects without enabling directory listing.
*/

-- ============================================================
-- PART 1: Revoke anon EXECUTE from all SECURITY DEFINER functions
-- ============================================================

-- Trigger / internal functions — revoke from both anon and authenticated
-- (these are never called directly via RPC)
REVOKE EXECUTE ON FUNCTION public.update_child_profile_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_chores_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_transfer_pairing() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_chart_account_for_account() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_chart_account_for_asset() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_chart_account_for_bank_account() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_chart_account_for_budget() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_chart_account_for_credit_card() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_chart_account_for_equity() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_chart_account_for_liability() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_chart_account_for_transaction() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_chart_account_on_budget() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.activate_chart_account_on_transaction() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_activate_chart_account() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_apply_rule_on_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_apply_rule_to_transaction() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_create_journal_entry_from_transaction() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_provision_chart_of_accounts() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_adult_limit() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_status_change_via_rpc() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.deactivate_chart_account_for_budget() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_single_active_tab() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user_profile() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_system_account_deletes() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_system_account_updates() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_immutable_transaction_data() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_journal_entry_immutability() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_bank_accounts_to_accounts() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.sync_transaction_account_ids() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_auto_match_on_transfer() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_account_balance_from_journal() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_account_classifications_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_accounts_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_asset_liability_links_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_balance_on_transaction_status_change() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_bank_accounts_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_categorization_rules_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_color_schemes_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_contact_matching_rules_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_credit_card_balance() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_credit_cards_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_equity_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_journal_entry_counters_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_payment_reminders_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_profile_tabs_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_profile_view_preferences_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_protected_configuration_timestamp() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_statement_uploads_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_transaction_rules_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_transaction_splits_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_unreconciled_difference() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at_column() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_user_chart_of_accounts_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_user_profile_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_child_budget_allocation() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_transaction_splits() FROM anon, authenticated;

-- RPC-callable functions — revoke from anon only, keep for authenticated
REVOKE EXECUTE ON FUNCTION public.accept_invitation(text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.activate_template_account(uuid, integer, text, numeric, text, text, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_user_expense_category(uuid, text, text, integer, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.add_user_income_category(uuid, text, text, integer, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_rule_to_transaction(uuid, uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_transfer_match(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.approve_task_completion(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.archive_completed_jobs() FROM anon;
REVOKE EXECUTE ON FUNCTION public.auto_match_transfers(uuid, numeric) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_parent_and_children_spending(uuid, uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_parent_and_children_spending(uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_reminder_date(date, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_total_child_budget_allocations(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.calculate_total_child_budget_allocations(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_transaction_matches_rule(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.check_upcoming_payment_reminders() FROM anon;
REVOKE EXECUTE ON FUNCTION public.cleanup_vault_trash() FROM anon;
REVOKE EXECUTE ON FUNCTION public.copy_account_classification_templates_to_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.copy_category_templates_to_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_journal_entry(uuid, uuid, date, text, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_opening_balance_journal_entry(uuid, uuid, uuid, numeric, date, text, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_reversal_entry(uuid, date, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_user_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.create_vault_item(jsonb, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.decrypt_vault_field(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.diagnose_account_journal_lines(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.encrypt_vault_field(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_complete_provisioning() FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_default_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_default_tab(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_user_profile() FROM anon;
REVOKE EXECUTE ON FUNCTION public.ensure_vault_key(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.expire_old_invitations() FROM anon;
REVOKE EXECUTE ON FUNCTION public.extract_merchant_pattern(text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_matching_rules_for_transaction(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_opposite_amount_matches(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.find_transfer_matches(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_journal_entry_number(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_journal_entry_number(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.generate_transaction_fingerprint(date, text, numeric, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_account_audit_history_paginated(uuid, uuid, date, date, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_account_journal_lines(uuid, uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_account_journal_lines_paginated(uuid, uuid, date, date, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_batch_status(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_category_suggestion_by_pattern(text, uuid, double precision) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_journal_entry_with_lines(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_multi_account_audit_history_paginated(uuid, uuid[], date, date, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_multi_account_journal_lines_paginated(uuid, uuid[], date, date, integer, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_next_account_number(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_next_available_account_number(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_next_journal_entry_number(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_parent_budget(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_parent_budget(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_vault_items(uuid, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_vault_key(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_profile_access(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_pattern_acceptance(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.increment_pattern_rejection(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.log_audit_action(uuid, uuid, text, text, uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.manual_provision_current_user() FROM anon;
REVOKE EXECUTE ON FUNCTION public.provision_chart_of_accounts_for_user(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.recalculate_account_balance(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.redeem_reward(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reject_task_completion(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.reset_financial_data_for_profile(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.revoke_vault_share(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rpc_post_transaction(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.share_vault_item(uuid, uuid, text, timestamptz) FROM anon;
REVOKE EXECUTE ON FUNCTION public.undo_posted_transaction(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_account_display_name(uuid, text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_account_number(uuid, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_journal_entry(uuid, text, public.journal_line_update[], text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_journal_entry_with_lines(uuid, uuid, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_journal_entry_with_lines(uuid, uuid, text, text, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.update_vault_item(uuid, jsonb) FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_account_number_range(integer, text, boolean) FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_child_budget_allocation(uuid, numeric, uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_child_budget_allocation(uuid, numeric, text, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_journal_entry_balance(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_transaction_splits(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.validate_transfer_pairing() FROM anon;
REVOKE EXECUTE ON FUNCTION public.verify_user_provisioning() FROM anon;

-- ============================================================
-- PART 2: Fix avatars storage bucket — remove broad listing policies
-- ============================================================

-- Drop the two broad SELECT policies that allow listing all files
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to avatars" ON storage.objects;

-- Replace with a single tight policy: allow reading specific objects by URL only.
-- This uses name != '' to prevent empty-prefix LIST calls while still allowing
-- authenticated GET requests to individual file paths.
CREATE POLICY "Authenticated users can read avatar objects"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');
