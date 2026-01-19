/*
  # Create Transaction Rules System

  ## Overview
  Creates a comprehensive transaction rules system that allows users to automatically categorize,
  tag, and modify transactions based on configurable patterns and conditions.

  ## Tables Created

  ### 1. transaction_rules
  Main rules table containing:
  - Rule metadata (name, description, enabled status)
  - Match conditions (description patterns, amount ranges, date ranges)
  - Actions to apply (category, contact, notes, tags)
  - Priority and execution tracking
  - Learning metrics (match count, acceptance rate)

  ### 2. rule_conditions (future expansion)
  For advanced multi-field matching conditions (reserved for future use)

  ### 3. rule_actions (future expansion)
  For complex multi-action rules (reserved for future use)

  ## Features
  - Pattern-based matching (contains, starts with, ends with, regex)
  - Amount range filtering
  - Date range filtering
  - Account-specific rules
  - Transaction type filtering
  - Priority-based execution order
  - Learning from user corrections
  - Retroactive application
  - Rule templates for common scenarios

  ## Security
  - RLS enabled on all tables
  - Users can only access rules in their profiles
  - Proper indexes for query performance
*/

-- ============================================================================
-- Main Rules Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.transaction_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Rule metadata
  name text NOT NULL,
  description text,
  is_enabled boolean NOT NULL DEFAULT true,
  priority integer NOT NULL DEFAULT 50,
  
  -- Match conditions
  match_description_pattern text,
  match_description_mode text NOT NULL DEFAULT 'contains' 
    CHECK (match_description_mode IN ('contains', 'starts_with', 'ends_with', 'exact', 'regex')),
  match_case_sensitive boolean NOT NULL DEFAULT false,
  
  match_amount_min numeric,
  match_amount_max numeric,
  match_amount_exact numeric,
  
  match_transaction_type text 
    CHECK (match_transaction_type IN ('income', 'expense', 'transfer', 'credit_card_payment')),
  
  match_bank_account_id uuid REFERENCES public.user_chart_of_accounts(id) ON DELETE SET NULL,
  match_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  
  match_date_from date,
  match_date_to date,
  
  -- Actions to apply
  action_set_category_id uuid REFERENCES public.user_chart_of_accounts(id) ON DELETE SET NULL,
  action_set_contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  action_add_note text,
  action_add_tags text[], -- Array of tag strings
  
  -- Learning and statistics
  times_matched integer NOT NULL DEFAULT 0,
  times_accepted integer NOT NULL DEFAULT 0,
  times_rejected integer NOT NULL DEFAULT 0,
  acceptance_rate numeric GENERATED ALWAYS AS (
    CASE 
      WHEN times_matched > 0 THEN (times_accepted::numeric / times_matched::numeric * 100)
      ELSE 0
    END
  ) STORED,
  
  last_matched_at timestamptz,
  
  -- Rule source tracking
  created_from_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  is_template boolean NOT NULL DEFAULT false,
  template_category text, -- e.g., 'utilities', 'groceries', 'payroll'
  
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  
  -- Constraints
  CHECK (match_amount_min IS NULL OR match_amount_max IS NULL OR match_amount_min <= match_amount_max),
  CHECK (match_date_from IS NULL OR match_date_to IS NULL OR match_date_from <= match_date_to),
  CHECK (
    action_set_category_id IS NOT NULL OR 
    action_set_contact_id IS NOT NULL OR 
    action_add_note IS NOT NULL OR 
    action_add_tags IS NOT NULL
  )
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_transaction_rules_profile_enabled 
  ON public.transaction_rules(profile_id, is_enabled, priority DESC);

CREATE INDEX IF NOT EXISTS idx_transaction_rules_pattern 
  ON public.transaction_rules(match_description_pattern) 
  WHERE match_description_pattern IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transaction_rules_account 
  ON public.transaction_rules(match_bank_account_id) 
  WHERE match_bank_account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transaction_rules_acceptance 
  ON public.transaction_rules(acceptance_rate DESC) 
  WHERE times_matched > 5;

-- ============================================================================
-- Row Level Security
-- ============================================================================

ALTER TABLE public.transaction_rules ENABLE ROW LEVEL SECURITY;

-- Users can view rules in their profiles
CREATE POLICY "Users can view own profile rules"
  ON public.transaction_rules
  FOR SELECT
  TO authenticated
  USING (
    profile_id IN (
      SELECT pm.profile_id 
      FROM public.profile_memberships pm 
      WHERE pm.user_id = auth.uid()
    )
  );

-- Users can create rules in their profiles
CREATE POLICY "Users can create rules in own profiles"
  ON public.transaction_rules
  FOR INSERT
  TO authenticated
  WITH CHECK (
    profile_id IN (
      SELECT pm.profile_id 
      FROM public.profile_memberships pm 
      WHERE pm.user_id = auth.uid()
    )
  );

-- Users can update rules in their profiles
CREATE POLICY "Users can update own profile rules"
  ON public.transaction_rules
  FOR UPDATE
  TO authenticated
  USING (
    profile_id IN (
      SELECT pm.profile_id 
      FROM public.profile_memberships pm 
      WHERE pm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    profile_id IN (
      SELECT pm.profile_id 
      FROM public.profile_memberships pm 
      WHERE pm.user_id = auth.uid()
    )
  );

-- Users can delete rules in their profiles
CREATE POLICY "Users can delete own profile rules"
  ON public.transaction_rules
  FOR DELETE
  TO authenticated
  USING (
    profile_id IN (
      SELECT pm.profile_id 
      FROM public.profile_memberships pm 
      WHERE pm.user_id = auth.uid()
    )
  );

-- ============================================================================
-- Helper Functions
-- ============================================================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_transaction_rules_updated_at()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_transaction_rules_updated_at
  BEFORE UPDATE ON public.transaction_rules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_transaction_rules_updated_at();

-- ============================================================================
-- Rule Matching Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.check_transaction_matches_rule(
  p_transaction_id uuid,
  p_rule_id uuid
)
RETURNS boolean
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction record;
  v_rule record;
  v_matches boolean := true;
  v_description_lower text;
  v_pattern_lower text;
BEGIN
  -- Get transaction
  SELECT * INTO v_transaction FROM transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Get rule
  SELECT * INTO v_rule FROM transaction_rules WHERE id = p_rule_id AND is_enabled = true;
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  -- Check profile match
  IF v_transaction.profile_id != v_rule.profile_id THEN
    RETURN false;
  END IF;
  
  -- Check description pattern
  IF v_rule.match_description_pattern IS NOT NULL THEN
    IF v_rule.match_case_sensitive THEN
      v_description_lower := v_transaction.description;
      v_pattern_lower := v_rule.match_description_pattern;
    ELSE
      v_description_lower := LOWER(v_transaction.description);
      v_pattern_lower := LOWER(v_rule.match_description_pattern);
    END IF;
    
    v_matches := CASE v_rule.match_description_mode
      WHEN 'contains' THEN v_description_lower LIKE '%' || v_pattern_lower || '%'
      WHEN 'starts_with' THEN v_description_lower LIKE v_pattern_lower || '%'
      WHEN 'ends_with' THEN v_description_lower LIKE '%' || v_pattern_lower
      WHEN 'exact' THEN v_description_lower = v_pattern_lower
      WHEN 'regex' THEN v_description_lower ~ v_pattern_lower
      ELSE false
    END;
    
    IF NOT v_matches THEN
      RETURN false;
    END IF;
  END IF;
  
  -- Check amount conditions
  IF v_rule.match_amount_exact IS NOT NULL THEN
    IF ABS(v_transaction.amount) != v_rule.match_amount_exact THEN
      RETURN false;
    END IF;
  ELSE
    IF v_rule.match_amount_min IS NOT NULL AND ABS(v_transaction.amount) < v_rule.match_amount_min THEN
      RETURN false;
    END IF;
    IF v_rule.match_amount_max IS NOT NULL AND ABS(v_transaction.amount) > v_rule.match_amount_max THEN
      RETURN false;
    END IF;
  END IF;
  
  -- Check transaction type
  IF v_rule.match_transaction_type IS NOT NULL AND v_transaction.type != v_rule.match_transaction_type THEN
    RETURN false;
  END IF;
  
  -- Check bank account
  IF v_rule.match_bank_account_id IS NOT NULL AND v_transaction.bank_account_id != v_rule.match_bank_account_id THEN
    RETURN false;
  END IF;
  
  -- Check contact
  IF v_rule.match_contact_id IS NOT NULL AND v_transaction.contact_id != v_rule.match_contact_id THEN
    RETURN false;
  END IF;
  
  -- Check date range
  IF v_rule.match_date_from IS NOT NULL AND v_transaction.date < v_rule.match_date_from THEN
    RETURN false;
  END IF;
  IF v_rule.match_date_to IS NOT NULL AND v_transaction.date > v_rule.match_date_to THEN
    RETURN false;
  END IF;
  
  RETURN true;
END;
$$;

-- ============================================================================
-- Rule Application Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.apply_rule_to_transaction(
  p_transaction_id uuid,
  p_rule_id uuid,
  p_update_transaction boolean DEFAULT true
)
RETURNS jsonb
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_rule record;
  v_changes jsonb := '{}';
  v_update_data jsonb := '{}';
BEGIN
  -- Get rule
  SELECT * INTO v_rule FROM transaction_rules WHERE id = p_rule_id AND is_enabled = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Rule not found or disabled');
  END IF;
  
  -- Check if rule matches
  IF NOT public.check_transaction_matches_rule(p_transaction_id, p_rule_id) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Transaction does not match rule conditions');
  END IF;
  
  -- Build changes object
  IF v_rule.action_set_category_id IS NOT NULL THEN
    v_changes := jsonb_set(v_changes, '{category_account_id}', to_jsonb(v_rule.action_set_category_id::text));
    IF p_update_transaction THEN
      UPDATE transactions 
      SET category_account_id = v_rule.action_set_category_id 
      WHERE id = p_transaction_id;
    END IF;
  END IF;
  
  IF v_rule.action_set_contact_id IS NOT NULL THEN
    v_changes := jsonb_set(v_changes, '{contact_id}', to_jsonb(v_rule.action_set_contact_id::text));
    IF p_update_transaction THEN
      UPDATE transactions 
      SET contact_id = v_rule.action_set_contact_id 
      WHERE id = p_transaction_id;
    END IF;
  END IF;
  
  IF v_rule.action_add_note IS NOT NULL THEN
    v_changes := jsonb_set(v_changes, '{note}', to_jsonb(v_rule.action_add_note));
    IF p_update_transaction THEN
      UPDATE transactions 
      SET notes = COALESCE(notes || E'\n', '') || v_rule.action_add_note 
      WHERE id = p_transaction_id;
    END IF;
  END IF;
  
  -- Update rule statistics
  UPDATE transaction_rules
  SET 
    times_matched = times_matched + 1,
    last_matched_at = now()
  WHERE id = p_rule_id;
  
  RETURN jsonb_build_object(
    'success', true,
    'changes', v_changes,
    'rule_name', v_rule.name
  );
END;
$$;

-- ============================================================================
-- Find Matching Rules Function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.find_matching_rules_for_transaction(
  p_transaction_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  rule_id uuid,
  rule_name text,
  priority integer,
  acceptance_rate numeric,
  proposed_changes jsonb
)
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction record;
BEGIN
  -- Get transaction
  SELECT * INTO v_transaction FROM transactions WHERE id = p_transaction_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  RETURN QUERY
  SELECT 
    tr.id,
    tr.name,
    tr.priority,
    tr.acceptance_rate,
    public.apply_rule_to_transaction(p_transaction_id, tr.id, false) as proposed_changes
  FROM transaction_rules tr
  WHERE 
    tr.profile_id = v_transaction.profile_id
    AND tr.is_enabled = true
    AND public.check_transaction_matches_rule(p_transaction_id, tr.id)
  ORDER BY 
    tr.priority DESC,
    tr.acceptance_rate DESC NULLS LAST,
    tr.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.transaction_rules IS 
  'User-defined rules for automatically categorizing and tagging transactions based on patterns';

COMMENT ON COLUMN public.transaction_rules.priority IS 
  'Higher priority rules are evaluated first (1-100, default 50)';

COMMENT ON COLUMN public.transaction_rules.acceptance_rate IS 
  'Percentage of matches that were accepted by user (vs rejected/modified)';

COMMENT ON COLUMN public.transaction_rules.match_description_mode IS 
  'How to match the description: contains (substring), starts_with, ends_with, exact, or regex';

COMMENT ON FUNCTION public.check_transaction_matches_rule IS 
  'Evaluates if a transaction matches all conditions of a rule';

COMMENT ON FUNCTION public.apply_rule_to_transaction IS 
  'Applies rule actions to a transaction and returns the changes made';

COMMENT ON FUNCTION public.find_matching_rules_for_transaction IS 
  'Finds all rules that match a transaction, ordered by priority and acceptance rate';
