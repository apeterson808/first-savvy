/*
  # Fix SECURITY DEFINER Function Execute Permissions

  ## Summary
  Restrict execute permissions on SECURITY DEFINER functions to prevent
  authenticated users from calling internal/system functions they should
  never invoke directly.

  ## Changes

  ### Functions with EXECUTE revoked from authenticated role
  These are internal/system functions that should only run via triggers,
  cron jobs, edge functions (service role), or other server-side processes.
  No end-user should be able to call these directly via REST API.

  1. archive_completed_jobs - internal cron/batch job archival
  2. check_upcoming_payment_reminders - internal cron/notification
  3. cleanup_vault_trash - internal cron cleanup
  4. copy_account_classification_templates_to_user - provisioning internal
  5. copy_category_templates_to_user - provisioning internal
  6. create_user_profile - trigger function
  7. ensure_complete_provisioning - provisioning internal
  8. ensure_default_profile - provisioning internal
  9. ensure_default_tab - provisioning internal
  10. ensure_user_profile - provisioning internal
  11. expire_old_invitations - internal cron
  12. generate_transaction_fingerprint - internal utility
  13. get_batch_status - internal batch tracking
  14. increment_pattern_acceptance - should be internal
  15. increment_pattern_rejection - should be internal
  16. manual_provision_current_user - provisioning (keep for authenticated, see below)
  17. provision_chart_of_accounts_for_user - provisioning internal
  18. validate_account_number_range - trigger/internal validation
  19. validate_journal_entry_balance - trigger validation
  20. validate_transaction_splits - trigger validation
  21. verify_user_provisioning - internal diagnostic
  22. calculate_reminder_date - internal utility
  23. diagnose_account_journal_lines - diagnostic/debug

  ### Functions that keep authenticated EXECUTE but add ownership checks
  These are legitimately called by authenticated users but only for their
  own data - they already contain auth.uid() checks internally.

  Note: Supabase's PostgREST requires EXECUTE grant to expose via /rpc/.
  For functions that ARE called by the frontend, we keep the grant.
  The security model relies on the function body's ownership checks.

  ## Security Notes
  - SECURITY DEFINER functions run as the function owner (postgres)
  - Each function must validate the caller owns the data being accessed
  - Revoking EXECUTE from authenticated means only service_role can call them
*/

-- ============================================================
-- REVOKE EXECUTE from authenticated for purely internal functions
-- These should never be called by end-users via /rest/v1/rpc/
-- ============================================================

-- Internal cron/batch operations
REVOKE EXECUTE ON FUNCTION public.archive_completed_jobs() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.check_upcoming_payment_reminders() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_vault_trash() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_old_invitations() FROM authenticated;

-- Provisioning internals (called only by triggers or service role)
REVOKE EXECUTE ON FUNCTION public.create_user_profile() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.copy_account_classification_templates_to_user(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.copy_category_templates_to_user(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.provision_chart_of_accounts_for_user(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_complete_provisioning() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_default_profile() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_default_tab(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.ensure_user_profile() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.verify_user_provisioning() FROM authenticated;

-- Internal validation (called by triggers, not users)
REVOKE EXECUTE ON FUNCTION public.validate_account_number_range(integer, text, boolean) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_journal_entry_balance(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.validate_transaction_splits(uuid) FROM authenticated;

-- Internal utility/diagnostic (not needed via REST)
REVOKE EXECUTE ON FUNCTION public.generate_transaction_fingerprint(date, text, numeric, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.get_batch_status(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.calculate_reminder_date(date, integer) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.diagnose_account_journal_lines(uuid) FROM authenticated;

-- Pattern tracking (should be internal)
REVOKE EXECUTE ON FUNCTION public.increment_pattern_acceptance(uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_pattern_rejection(uuid) FROM authenticated;

-- ============================================================
-- Grant EXECUTE only to service_role for the revoked functions
-- (ensures edge functions and server-side code can still call them)
-- ============================================================
GRANT EXECUTE ON FUNCTION public.archive_completed_jobs() TO service_role;
GRANT EXECUTE ON FUNCTION public.check_upcoming_payment_reminders() TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_vault_trash() TO service_role;
GRANT EXECUTE ON FUNCTION public.expire_old_invitations() TO service_role;
GRANT EXECUTE ON FUNCTION public.create_user_profile() TO service_role;
GRANT EXECUTE ON FUNCTION public.copy_account_classification_templates_to_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.copy_category_templates_to_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.provision_chart_of_accounts_for_user(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_complete_provisioning() TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_default_profile() TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_default_tab(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.ensure_user_profile() TO service_role;
GRANT EXECUTE ON FUNCTION public.verify_user_provisioning() TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_account_number_range(integer, text, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_journal_entry_balance(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.validate_transaction_splits(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.generate_transaction_fingerprint(date, text, numeric, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_batch_status(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.calculate_reminder_date(date, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.diagnose_account_journal_lines(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_pattern_acceptance(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_pattern_rejection(uuid) TO service_role;
