/*
  # Remove Priority System from Transaction Rules

  ## Overview
  Removes the unused priority column and system from transaction_rules.
  Rules will now be ordered alphabetically by name instead of by priority.

  ## Changes Made
  1. Drop priority-based index
  2. Remove priority column from transaction_rules table
  3. Create new index ordering by name
  4. Update find_matching_rules_for_transaction function to order by name
  5. Update comments to remove priority references

  ## Impact
  - All rules currently have priority=50 (default), so no functional change
  - Simpler rule ordering based on alphabetical name
  - Reduced database schema complexity
*/

-- ============================================================================
-- Drop Priority-Based Index
-- ============================================================================

DROP INDEX IF EXISTS public.idx_transaction_rules_profile_enabled;

-- ============================================================================
-- Remove Priority Column
-- ============================================================================

ALTER TABLE public.transaction_rules
  DROP COLUMN IF EXISTS priority;

-- ============================================================================
-- Create New Index Ordered by Name
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_transaction_rules_profile_enabled_name
  ON public.transaction_rules(profile_id, is_enabled, name);

-- ============================================================================
-- Update Rule Matching Function to Order by Name
-- ============================================================================

-- Drop the old function first since we're changing the return type
DROP FUNCTION IF EXISTS public.find_matching_rules_for_transaction(uuid, integer);

-- Recreate without priority in return columns
CREATE OR REPLACE FUNCTION public.find_matching_rules_for_transaction(
  p_transaction_id uuid,
  p_limit integer DEFAULT 10
)
RETURNS TABLE(
  rule_id uuid,
  rule_name text,
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
    tr.acceptance_rate,
    public.apply_rule_to_transaction(p_transaction_id, tr.id, false) as proposed_changes
  FROM transaction_rules tr
  WHERE
    tr.profile_id = v_transaction.profile_id
    AND tr.is_enabled = true
    AND public.check_transaction_matches_rule(p_transaction_id, tr.id)
  ORDER BY
    tr.name ASC,
    tr.acceptance_rate DESC NULLS LAST,
    tr.created_at DESC
  LIMIT p_limit;
END;
$$;

-- ============================================================================
-- Update Comments
-- ============================================================================

COMMENT ON TABLE public.transaction_rules IS
  'User-defined rules for automatically categorizing and tagging transactions based on patterns';

COMMENT ON COLUMN public.transaction_rules.acceptance_rate IS
  'Percentage of matches that were accepted by user (vs rejected/modified)';

COMMENT ON COLUMN public.transaction_rules.match_description_mode IS
  'How to match the description: contains (substring), starts_with, ends_with, exact, or regex';

COMMENT ON FUNCTION public.check_transaction_matches_rule IS
  'Evaluates if a transaction matches all conditions of a rule';

COMMENT ON FUNCTION public.apply_rule_to_transaction IS
  'Applies rule actions to a transaction and returns the changes made';

COMMENT ON FUNCTION public.find_matching_rules_for_transaction IS
  'Finds all rules that match a transaction, ordered alphabetically by name';
