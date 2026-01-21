/*
  # Enable Automatic Rule Application System

  1. Overview
    - Creates triggers to automatically apply transaction rules without manual intervention
    - Rules apply immediately when created or updated
    - Rules apply automatically to new transactions as they're inserted

  2. Triggers Created
    - `trigger_auto_apply_rule_on_change`: Fires when rules are created or updated
    - `trigger_auto_apply_rules_on_insert`: Fires when new transactions are inserted

  3. Behavior
    - When a rule is created: Automatically applies to all matching pending transactions
    - When a rule is updated: Re-applies to all matching pending transactions
    - When a transaction is inserted: Automatically checks and applies matching enabled rules
    - Only processes pending transactions without an applied_rule_id

  4. Important Notes
    - Triggers use AFTER timing to ensure data is committed before processing
    - Security: Triggers use SECURITY DEFINER with explicit search_path
    - Performance: Only processes relevant transactions (pending status)
    - First matching rule wins (no priority needed)
*/

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS trigger_auto_apply_rule_on_change ON public.transaction_rules;
DROP TRIGGER IF EXISTS trigger_auto_apply_rules_on_insert ON public.transactions;

-- Create trigger for rule changes (INSERT and UPDATE)
CREATE TRIGGER trigger_auto_apply_rule_on_change
  AFTER INSERT OR UPDATE ON public.transaction_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_apply_rule_on_change();

COMMENT ON TRIGGER trigger_auto_apply_rule_on_change ON public.transaction_rules IS
  'Automatically applies rule to matching pending transactions when rule is created or updated';

-- Create trigger for new transactions
CREATE TRIGGER trigger_auto_apply_rules_on_insert
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_apply_rule_to_transaction();

COMMENT ON TRIGGER trigger_auto_apply_rules_on_insert ON public.transactions IS
  'Automatically applies matching enabled rules to new transactions on insert';
