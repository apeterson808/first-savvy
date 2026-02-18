/*
  # Fix Final Security Issues

  1. Indexes
    - Add missing indexes for ai_category_suggestions and ai_contact_suggestions foreign keys
    - Note: "Unused index" warnings are expected for newly created indexes

  2. Function Security
    - Fix function search paths using proper PostgreSQL syntax
    - Use search_path = 'public' instead of SET search_path TO public
*/

-- ============================================================================
-- 1. ADD MISSING INDEXES FOR FOREIGN KEYS
-- ============================================================================

-- ai_category_suggestions - suggested_category_account_id
CREATE INDEX IF NOT EXISTS idx_ai_category_suggestions_suggested_category_account_id 
ON ai_category_suggestions(suggested_category_account_id);

-- ai_contact_suggestions - suggested_contact_id
CREATE INDEX IF NOT EXISTS idx_ai_contact_suggestions_suggested_contact_id 
ON ai_contact_suggestions(suggested_contact_id);

-- ============================================================================
-- 2. FIX FUNCTION SEARCH PATHS WITH PROPER SYNTAX
-- ============================================================================

-- Drop and recreate each function with proper search_path configuration
-- Using search_path = 'public' instead of SET search_path TO public

DROP FUNCTION IF EXISTS calculate_total_child_budget_allocations(uuid);
CREATE FUNCTION calculate_total_child_budget_allocations(parent_account_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  total_allocated numeric := 0;
BEGIN
  SELECT COALESCE(SUM(allocated_amount), 0)
  INTO total_allocated
  FROM user_chart_of_accounts
  WHERE parent_account_id = calculate_total_child_budget_allocations.parent_account_id
    AND is_active = true;
  
  RETURN total_allocated;
END;
$$;

DROP FUNCTION IF EXISTS calculate_parent_and_children_spending(uuid, date, date);
CREATE FUNCTION calculate_parent_and_children_spending(
  p_account_id uuid,
  p_start_date date,
  p_end_date date
)
RETURNS TABLE(parent_spending numeric, children_spending numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  WITH parent_txns AS (
    SELECT COALESCE(SUM(ABS(t.amount)), 0) as parent_total
    FROM transactions t
    WHERE t.category_account_id = p_account_id
      AND t.date >= p_start_date
      AND t.date <= p_end_date
      AND t.status = 'posted'
      AND t.include_in_reports = true
  ),
  children_txns AS (
    SELECT COALESCE(SUM(ABS(t.amount)), 0) as children_total
    FROM transactions t
    JOIN user_chart_of_accounts uca ON t.category_account_id = uca.id
    WHERE uca.parent_account_id = p_account_id
      AND t.date >= p_start_date
      AND t.date <= p_end_date
      AND t.status = 'posted'
      AND t.include_in_reports = true
  )
  SELECT 
    parent_txns.parent_total as parent_spending,
    children_txns.children_total as children_spending
  FROM parent_txns, children_txns;
END;
$$;

DROP FUNCTION IF EXISTS get_parent_budget(uuid);
CREATE FUNCTION get_parent_budget(child_account_id uuid)
RETURNS TABLE(parent_id uuid, parent_allocated_amount numeric)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    uca.id as parent_id,
    uca.allocated_amount as parent_allocated_amount
  FROM user_chart_of_accounts child
  JOIN user_chart_of_accounts uca ON child.parent_account_id = uca.id
  WHERE child.id = child_account_id
    AND uca.is_active = true;
END;
$$;

DROP FUNCTION IF EXISTS validate_child_budget_allocation();
CREATE FUNCTION validate_child_budget_allocation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  parent_allocated numeric;
  siblings_total numeric;
  new_total numeric;
BEGIN
  IF NEW.parent_account_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT allocated_amount INTO parent_allocated
  FROM user_chart_of_accounts
  WHERE id = NEW.parent_account_id;

  IF parent_allocated IS NULL OR parent_allocated = 0 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(allocated_amount), 0) INTO siblings_total
  FROM user_chart_of_accounts
  WHERE parent_account_id = NEW.parent_account_id
    AND id != NEW.id
    AND is_active = true;

  new_total := siblings_total + COALESCE(NEW.allocated_amount, 0);

  IF new_total > parent_allocated THEN
    RAISE EXCEPTION 'Child budget allocations (%) exceed parent budget (%)', new_total, parent_allocated;
  END IF;

  RETURN NEW;
END;
$$;

DROP FUNCTION IF EXISTS reset_financial_data_for_profile(uuid);
CREATE FUNCTION reset_financial_data_for_profile(p_profile_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  DELETE FROM transaction_splits WHERE profile_id = p_profile_id;
  DELETE FROM transactions WHERE profile_id = p_profile_id;
  DELETE FROM journal_entry_lines WHERE profile_id = p_profile_id;
  DELETE FROM journal_entries WHERE profile_id = p_profile_id;
  DELETE FROM transfer_registry WHERE profile_id = p_profile_id;
  DELETE FROM transfer_patterns WHERE profile_id = p_profile_id;
  DELETE FROM credit_card_payment_registry WHERE profile_id = p_profile_id;
  DELETE FROM credit_card_payment_patterns WHERE profile_id = p_profile_id;
  DELETE FROM transaction_rules WHERE profile_id = p_profile_id;
  DELETE FROM transaction_categorization_memory WHERE profile_id = p_profile_id;
  DELETE FROM contacts WHERE profile_id = p_profile_id;
  
  UPDATE user_chart_of_accounts 
  SET 
    current_balance = 0,
    bank_balance = NULL,
    statement_balance = NULL,
    last_statement_date = NULL,
    last_synced_at = NULL,
    institution_name = NULL,
    account_number_last4 = NULL
  WHERE profile_id = p_profile_id
    AND template_account_number NOT IN ('3000.000', '9999.000');
  
  DELETE FROM user_chart_of_accounts 
  WHERE profile_id = p_profile_id 
    AND is_user_created = true;
END;
$$;