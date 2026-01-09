/*
  # Fix Remaining Security Issues - January 2026

  ## Security Fixes
  1. **Add Missing Foreign Key Indexes**
     - Add index on journal_entries.user_id
     - Add index on journal_entry_lines.user_id
     - Add index on profiles.user_id
  
  2. **Remove Unused Indexes**
     - Drop idx_transaction_splits_category_account_id (not being used)
     - Drop idx_transfer_registry_matched_transaction_id (not being used)
  
  3. **Fix Security Definer View**
     - Recreate v_profile_tabs_display without SECURITY DEFINER property
*/

-- =====================================================
-- ADD MISSING FOREIGN KEY INDEXES
-- =====================================================

-- Add index for journal_entries.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id_fkey 
ON journal_entries(user_id);

-- Add index for journal_entry_lines.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_journal_entry_lines_user_id_fkey 
ON journal_entry_lines(user_id);

-- Add index for profiles.user_id foreign key
CREATE INDEX IF NOT EXISTS idx_profiles_user_id_fkey 
ON profiles(user_id);

-- =====================================================
-- REMOVE UNUSED INDEXES
-- =====================================================

-- Drop unused transaction_splits index
DROP INDEX IF EXISTS idx_transaction_splits_category_account_id;

-- Drop unused transfer_registry index
DROP INDEX IF EXISTS idx_transfer_registry_matched_transaction_id;

-- =====================================================
-- FIX SECURITY DEFINER VIEW
-- =====================================================

-- Drop and recreate v_profile_tabs_display without SECURITY DEFINER
DROP VIEW IF EXISTS v_profile_tabs_display;

CREATE VIEW v_profile_tabs_display AS
SELECT 
  pt.id,
  pt.profile_id,
  pt.owner_user_id,
  pt.profile_type,
  pt.display_name,
  pt.tab_order,
  pt.is_active,
  pt.profile_metadata,
  pt.state_data,
  pt.last_accessed_at,
  pt.created_at,
  pt.updated_at,
  p.user_id
FROM profile_tabs pt
JOIN profiles p ON p.id = pt.profile_id;
