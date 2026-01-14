/*
  # Fix Security and Performance Issues - V3
  
  1. Performance Improvements
    - Add missing foreign key indexes
    - Remove unused indexes
    - Remove duplicate indexes
    
  2. Security Fixes
    - Optimize RLS policies to use (SELECT auth.uid()) pattern
    - Fix function search paths to be immutable
    - Remove SECURITY DEFINER from views where not needed
    
  3. Changes Made
    - Add indexes for unindexed foreign keys
    - Drop unused and duplicate indexes
    - Update RLS policies on transfer_patterns
    - Fix search_path on multiple functions
    - Update security definer views
*/

-- ============================================================================
-- STEP 1: Add Missing Foreign Key Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_transaction_splits_category_account_id 
  ON transaction_splits(category_account_id);

CREATE INDEX IF NOT EXISTS idx_transfer_patterns_from_account_id 
  ON transfer_patterns(from_account_id);

CREATE INDEX IF NOT EXISTS idx_transfer_patterns_to_account_id 
  ON transfer_patterns(to_account_id);

CREATE INDEX IF NOT EXISTS idx_transfer_registry_matched_transaction_id 
  ON transfer_registry(matched_transaction_id);

-- ============================================================================
-- STEP 2: Drop Unused Indexes
-- ============================================================================

DROP INDEX IF EXISTS idx_journal_entries_profile_date;
DROP INDEX IF EXISTS idx_journal_entry_lines_entry_id_account;
DROP INDEX IF EXISTS idx_journal_entries_user_id_fkey;
DROP INDEX IF EXISTS idx_journal_entry_lines_user_id_fkey;
DROP INDEX IF EXISTS idx_profiles_user_id_fkey;
DROP INDEX IF EXISTS idx_transactions_transfer_confidence;
DROP INDEX IF EXISTS idx_transfer_patterns_accounts;
DROP INDEX IF EXISTS idx_transfer_patterns_acceptance;
DROP INDEX IF EXISTS idx_journal_entry_counters_entry_type;

-- ============================================================================
-- STEP 3: Drop Duplicate Indexes (keep the _fkey version)
-- ============================================================================

DROP INDEX IF EXISTS idx_journal_entries_user_id;

-- ============================================================================
-- STEP 4: Optimize RLS Policies on transfer_patterns
-- ============================================================================

DROP POLICY IF EXISTS "Users can view own transfer patterns" ON transfer_patterns;
DROP POLICY IF EXISTS "Users can insert own transfer patterns" ON transfer_patterns;
DROP POLICY IF EXISTS "Users can update own transfer patterns" ON transfer_patterns;
DROP POLICY IF EXISTS "Users can delete own transfer patterns" ON transfer_patterns;

CREATE POLICY "Users can view own transfer patterns"
  ON transfer_patterns FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = transfer_patterns.profile_id
      AND profiles.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can insert own transfer patterns"
  ON transfer_patterns FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = transfer_patterns.profile_id
      AND profiles.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can update own transfer patterns"
  ON transfer_patterns FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = transfer_patterns.profile_id
      AND profiles.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "Users can delete own transfer patterns"
  ON transfer_patterns FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = transfer_patterns.profile_id
      AND profiles.user_id = (SELECT auth.uid())
    )
  );

-- ============================================================================
-- STEP 5: Fix Function Search Paths (with CASCADE)
-- ============================================================================

-- Fix update_journal_entry_counters_updated_at
DROP FUNCTION IF EXISTS update_journal_entry_counters_updated_at() CASCADE;
CREATE FUNCTION update_journal_entry_counters_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS journal_entry_counters_updated_at ON journal_entry_counters;
CREATE TRIGGER journal_entry_counters_updated_at
  BEFORE UPDATE ON journal_entry_counters
  FOR EACH ROW
  EXECUTE FUNCTION update_journal_entry_counters_updated_at();

-- Fix extract_transfer_reference
DROP FUNCTION IF EXISTS extract_transfer_reference(text) CASCADE;
CREATE FUNCTION extract_transfer_reference(p_description text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN regexp_replace(
    lower(p_description),
    '(transfer|payment|deposit|withdrawal|from|to|account)\s*',
    '',
    'gi'
  );
END;
$$;

-- Fix extract_account_reference
DROP FUNCTION IF EXISTS extract_account_reference(text) CASCADE;
CREATE FUNCTION extract_account_reference(p_description text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_result text;
BEGIN
  v_result := regexp_replace(
    lower(p_description),
    '.*(x+\d{4}|ending in \d{4}|\*{4}\d{4}).*',
    '\1',
    'i'
  );
  
  IF v_result = lower(p_description) THEN
    RETURN NULL;
  END IF;
  
  RETURN v_result;
END;
$$;

-- Fix has_transfer_keywords
DROP FUNCTION IF EXISTS has_transfer_keywords(text) CASCADE;
CREATE FUNCTION has_transfer_keywords(p_description text)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN p_description ~* '(transfer|xfer|payment sent|payment received|online transfer|mobile transfer)';
END;
$$;

-- Fix increment_pattern_acceptance
DROP FUNCTION IF EXISTS increment_pattern_acceptance(uuid) CASCADE;
CREATE FUNCTION increment_pattern_acceptance(p_pattern_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  UPDATE transfer_patterns
  SET
    total_transfers = total_transfers + 1,
    total_auto_detected = total_auto_detected + 1,
    total_accepted = total_accepted + 1,
    last_updated = now()
  WHERE id = p_pattern_id;
END;
$$;

-- Fix increment_pattern_rejection
DROP FUNCTION IF EXISTS increment_pattern_rejection(uuid) CASCADE;
CREATE FUNCTION increment_pattern_rejection(p_pattern_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  UPDATE transfer_patterns
  SET
    total_transfers = total_transfers + 1,
    total_auto_detected = total_auto_detected + 1,
    total_rejected = total_rejected + 1,
    last_updated = now()
  WHERE id = p_pattern_id;
END;
$$;

-- Fix calculate_transfer_confidence
DROP FUNCTION IF EXISTS calculate_transfer_confidence(numeric, numeric, uuid, uuid, uuid, text, text) CASCADE;
CREATE FUNCTION calculate_transfer_confidence(
  p_amount numeric,
  p_date_diff_days numeric,
  p_from_account_id uuid,
  p_to_account_id uuid,
  p_profile_id uuid,
  p_desc1 text,
  p_desc2 text
)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_confidence numeric := 0;
  v_has_keywords boolean;
  v_account_ref_match boolean := false;
  v_from_ref text;
  v_to_ref text;
  v_pattern_acceptance_rate numeric := 0;
BEGIN
  IF p_amount IS NULL OR p_desc1 IS NULL OR p_desc2 IS NULL THEN
    RETURN 0;
  END IF;

  v_confidence := 70;

  IF p_date_diff_days = 0 THEN
    v_confidence := v_confidence + 15;
  ELSIF p_date_diff_days = 1 THEN
    v_confidence := v_confidence + 10;
  ELSIF p_date_diff_days <= 3 THEN
    v_confidence := v_confidence + 5;
  ELSE
    v_confidence := v_confidence - (p_date_diff_days * 2);
  END IF;

  v_has_keywords := has_transfer_keywords(p_desc1) OR has_transfer_keywords(p_desc2);
  IF v_has_keywords THEN
    v_confidence := v_confidence + 10;
  END IF;

  v_from_ref := extract_account_reference(p_desc1);
  v_to_ref := extract_account_reference(p_desc2);
  
  IF v_from_ref IS NOT NULL AND v_to_ref IS NOT NULL AND v_from_ref = v_to_ref THEN
    v_account_ref_match := true;
    v_confidence := v_confidence + 15;
  END IF;

  SELECT acceptance_rate INTO v_pattern_acceptance_rate
  FROM transfer_patterns
  WHERE profile_id = p_profile_id
    AND from_account_id = p_from_account_id
    AND to_account_id = p_to_account_id
    AND total_auto_detected >= 3;

  IF v_pattern_acceptance_rate IS NOT NULL THEN
    IF v_pattern_acceptance_rate >= 80 THEN
      v_confidence := v_confidence + 10;
    ELSIF v_pattern_acceptance_rate >= 60 THEN
      v_confidence := v_confidence + 5;
    ELSIF v_pattern_acceptance_rate < 40 THEN
      v_confidence := v_confidence - 10;
    END IF;
  END IF;

  RETURN LEAST(100, GREATEST(0, v_confidence));
END;
$$;

-- Fix auto_detect_transfers
DROP FUNCTION IF EXISTS auto_detect_transfers(uuid, uuid[]) CASCADE;
CREATE FUNCTION auto_detect_transfers(
  p_profile_id uuid,
  p_transaction_ids uuid[]
)
RETURNS TABLE(
  from_transaction_id uuid,
  to_transaction_id uuid,
  confidence numeric
)
LANGUAGE plpgsql
STABLE
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  RETURN QUERY
  WITH target_transactions AS (
    SELECT
      t.id,
      t.amount,
      t.description,
      t.date,
      t.bank_account_id
    FROM transactions t
    WHERE t.id = ANY(p_transaction_ids)
      AND t.profile_id = p_profile_id
  ),
  potential_matches AS (
    SELECT
      tt.id as from_id,
      t2.id as to_id,
      tt.amount,
      tt.description as from_desc,
      t2.description as to_desc,
      ABS(EXTRACT(EPOCH FROM (t2.date - tt.date)) / 86400) as date_diff,
      tt.bank_account_id as from_account,
      t2.bank_account_id as to_account
    FROM target_transactions tt
    INNER JOIN transactions t2 ON
      t2.profile_id = p_profile_id
      AND t2.id != tt.id
      AND ABS(t2.amount - tt.amount) < 0.01
      AND t2.bank_account_id != tt.bank_account_id
      AND ABS(EXTRACT(EPOCH FROM (t2.date - tt.date)) / 86400) <= 7
      AND t2.transfer_pair_id IS NULL
      AND t2.type != 'transfer'
    WHERE tt.transfer_pair_id IS NULL
      AND tt.type != 'transfer'
  )
  SELECT
    pm.from_id,
    pm.to_id,
    calculate_transfer_confidence(
      pm.amount,
      pm.date_diff,
      pm.from_account,
      pm.to_account,
      p_profile_id,
      pm.from_desc,
      pm.to_desc
    ) as conf
  FROM potential_matches pm
  WHERE calculate_transfer_confidence(
    pm.amount,
    pm.date_diff,
    pm.from_account,
    pm.to_account,
    p_profile_id,
    pm.from_desc,
    pm.to_desc
  ) >= 75
  ORDER BY conf DESC;
END;
$$;

-- ============================================================================
-- STEP 6: Drop SECURITY DEFINER from views (recreate without it)
-- ============================================================================

-- Drop and recreate v_profile_tabs_display without SECURITY DEFINER
DROP VIEW IF EXISTS v_profile_tabs_display;
CREATE VIEW v_profile_tabs_display AS
SELECT 
  pt.id,
  pt.owner_user_id,
  pt.profile_id,
  pt.display_name as tab_display_name,
  p.display_name as profile_display_name,
  p.profile_type,
  pt.tab_order,
  pt.is_active,
  pt.last_accessed_at,
  pt.created_at
FROM profile_tabs pt
LEFT JOIN profiles p ON p.id = pt.profile_id
WHERE pt.owner_user_id = (SELECT auth.uid())
ORDER BY pt.tab_order;

-- Drop and recreate account_activity_summary without SECURITY DEFINER
DROP VIEW IF EXISTS account_activity_summary;
CREATE VIEW account_activity_summary AS
SELECT
  a.id as account_id,
  a.display_name,
  a.class,
  a.current_balance,
  COUNT(DISTINCT jel.id) as transaction_count,
  MAX(je.entry_date) as last_transaction_date,
  a.profile_id
FROM user_chart_of_accounts a
LEFT JOIN journal_entry_lines jel ON jel.account_id = a.id
LEFT JOIN journal_entries je ON je.id = jel.journal_entry_id
WHERE a.is_active = true
GROUP BY a.id, a.display_name, a.class, a.current_balance, a.profile_id;
