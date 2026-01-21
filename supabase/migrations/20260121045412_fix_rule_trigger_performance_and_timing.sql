/*
  # Fix Rule Creation Performance and Auto-Apply Timing

  1. Changes to `auto_apply_rule_on_change` Function
    - Add transaction processing limit (max 100 transactions per rule change)
    - Add exception handling to prevent errors from blocking rule creation
    - Add early exit if too many transactions to process
    - Only process pending transactions without existing rule assignments

  2. Changes to Trigger
    - Modify trigger to only fire on UPDATE, not INSERT
    - This allows rules to be created instantly without processing
    - Auto-apply still works when rules are updated
    - Prevents timeout issues during rule creation

  3. Performance Optimizations
    - Add indexes on transaction columns used in rule matching
    - Index on description for pattern matching
    - Index on amount for range queries
    - Composite index for common filter combinations

  4. Benefits
    - Instant rule creation without timeouts
    - Users can review rules before applying
    - Automatic processing when rules are updated
    - Better error visibility and handling
*/

-- Add pg_trgm extension first (required for pattern matching indexes)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Drop the existing trigger first
DROP TRIGGER IF EXISTS trigger_auto_apply_rule_on_change ON public.transaction_rules;

-- Replace the auto_apply_rule_on_change function with improved version
CREATE OR REPLACE FUNCTION public.auto_apply_rule_on_change()
RETURNS trigger
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction RECORD;
  v_result jsonb;
  v_processed_count integer := 0;
  v_max_transactions integer := 100; -- Limit to prevent timeouts
  v_error_count integer := 0;
BEGIN
  -- Only process if rule is enabled
  IF NEW.is_enabled = false THEN
    RETURN NEW;
  END IF;

  -- Only auto-apply on UPDATE operations (not INSERT)
  -- This allows rules to be created without immediate processing
  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  -- Loop through pending transactions that match this rule's profile
  -- Only process transactions without an applied rule, or those that used this rule
  -- LIMIT to prevent timeout issues
  BEGIN
    FOR v_transaction IN
      SELECT t.id
      FROM public.transactions t
      WHERE t.profile_id = NEW.profile_id
        AND t.status = 'pending'
        AND (t.applied_rule_id IS NULL OR t.applied_rule_id = NEW.id)
      ORDER BY t.date DESC
      LIMIT v_max_transactions
    LOOP
      BEGIN
        -- Check if this transaction matches the rule
        IF public.check_transaction_matches_rule(v_transaction.id, NEW.id) THEN
          -- Apply the rule to the transaction
          v_result := public.apply_rule_to_transaction(
            v_transaction.id,
            NEW.id,
            true -- update_transaction = true
          );

          v_processed_count := v_processed_count + 1;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        -- Log error but continue processing other transactions
        v_error_count := v_error_count + 1;
        RAISE WARNING 'Error applying rule % to transaction %: %',
          NEW.id, v_transaction.id, SQLERRM;

        -- If too many errors, stop processing
        IF v_error_count > 10 THEN
          RAISE WARNING 'Too many errors applying rule %, stopping auto-apply', NEW.id;
          EXIT;
        END IF;
      END;
    END LOOP;

    -- Log processing summary
    RAISE NOTICE 'Auto-applied rule % to % transactions (% errors)',
      NEW.id, v_processed_count, v_error_count;

  EXCEPTION WHEN OTHERS THEN
    -- Catch any outer errors to prevent rule creation/update from failing
    RAISE WARNING 'Error in auto_apply_rule_on_change for rule %: %', NEW.id, SQLERRM;
  END;

  RETURN NEW;
END;
$$;

-- Recreate trigger to only fire on UPDATE (not INSERT)
CREATE TRIGGER trigger_auto_apply_rule_on_change
  AFTER UPDATE ON public.transaction_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_apply_rule_on_change();

-- Add performance indexes for rule matching
-- These speed up the check_transaction_matches_rule function

-- Index for description pattern matching
CREATE INDEX IF NOT EXISTS idx_transactions_description_pattern
  ON public.transactions USING gin(description gin_trgm_ops);

-- Index for original description pattern matching
CREATE INDEX IF NOT EXISTS idx_transactions_original_description_pattern
  ON public.transactions USING gin(original_description gin_trgm_ops);

-- Index for amount range queries
CREATE INDEX IF NOT EXISTS idx_transactions_amount
  ON public.transactions(amount);

-- Composite index for common filter combinations
CREATE INDEX IF NOT EXISTS idx_transactions_status_profile_date
  ON public.transactions(status, profile_id, date DESC);

-- Index for bank account filtering (already exists but ensuring it's there)
CREATE INDEX IF NOT EXISTS idx_transactions_bank_account_id
  ON public.transactions(bank_account_id);

-- Index for contact filtering (already exists but ensuring it's there)
CREATE INDEX IF NOT EXISTS idx_transactions_contact_id
  ON public.transactions(contact_id);

-- Add comment explaining the change
COMMENT ON TRIGGER trigger_auto_apply_rule_on_change ON public.transaction_rules IS
  'Auto-applies rule changes to matching transactions. Only fires on UPDATE to prevent timeout during rule creation. Users can manually apply rules after creation.';

COMMENT ON FUNCTION public.auto_apply_rule_on_change() IS
  'Processes up to 100 pending transactions when a rule is updated. Includes error handling to prevent failures from blocking rule updates.';