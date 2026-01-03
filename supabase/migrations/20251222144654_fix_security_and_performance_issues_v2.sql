/*
  # Fix Security and Performance Issues
  
  ## Overview
  This migration addresses security and performance issues identified by the database analyzer.
  
  ## Changes
  
  ### 1. Add Missing Foreign Key Indexes
  - Add index on `assets.parent_account_id` for hierarchical queries
  - Add index on `liabilities.parent_account_id` for hierarchical queries
  - Add index on `liabilities.user_id` for user filtering
  
  ### 2. Optimize RLS Policies on asset_liability_links
  Replace `auth.uid()` with `(select auth.uid())` to prevent re-evaluation per row.
  This significantly improves query performance at scale.
  
  ### 3. Remove Unused Indexes
  Drop indexes that are not being used to reduce storage overhead and improve write performance:
  - `idx_bank_accounts_parent_account_id`
  - `idx_categories_parent_account_id`
  - `idx_configuration_change_log_user_id`
  - `idx_contacts_default_category_id`
  - `idx_credit_cards_parent_account_id`
  - `idx_liabilities_linked_asset_id`
  - `idx_assets_property_zip`
  - `idx_assets_property_type`
  
  ### 4. Fix Function Security
  Update `update_asset_liability_links_updated_at` function to have immutable search_path.
  
  ## Security Notes
  - All changes maintain existing security posture
  - RLS policy optimizations improve performance without changing access control
  - Function security improvements prevent search_path vulnerabilities
*/

-- Step 1: Add missing foreign key indexes
CREATE INDEX IF NOT EXISTS idx_assets_parent_account_id ON assets(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_liabilities_parent_account_id ON liabilities(parent_account_id);
CREATE INDEX IF NOT EXISTS idx_liabilities_user_id ON liabilities(user_id);

-- Step 2: Optimize RLS policies on asset_liability_links
-- Drop existing policies
DROP POLICY IF EXISTS "Users can view own asset liability links" ON asset_liability_links;
DROP POLICY IF EXISTS "Users can create own asset liability links" ON asset_liability_links;
DROP POLICY IF EXISTS "Users can update own asset liability links" ON asset_liability_links;
DROP POLICY IF EXISTS "Users can delete own asset liability links" ON asset_liability_links;

-- Recreate with optimized auth.uid() calls
CREATE POLICY "Users can view own asset liability links"
  ON asset_liability_links FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "Users can create own asset liability links"
  ON asset_liability_links FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND EXISTS (SELECT 1 FROM assets WHERE id = asset_id AND user_id = (select auth.uid()))
    AND EXISTS (SELECT 1 FROM liabilities WHERE id = liability_id AND user_id = (select auth.uid()))
  );

CREATE POLICY "Users can update own asset liability links"
  ON asset_liability_links FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "Users can delete own asset liability links"
  ON asset_liability_links FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- Step 3: Remove unused indexes
DROP INDEX IF EXISTS idx_bank_accounts_parent_account_id;
DROP INDEX IF EXISTS idx_categories_parent_account_id;
DROP INDEX IF EXISTS idx_configuration_change_log_user_id;
DROP INDEX IF EXISTS idx_contacts_default_category_id;
DROP INDEX IF EXISTS idx_credit_cards_parent_account_id;
DROP INDEX IF EXISTS idx_liabilities_linked_asset_id;
DROP INDEX IF EXISTS idx_assets_property_zip;
DROP INDEX IF EXISTS idx_assets_property_type;

-- Step 4: Fix function security (set immutable search_path)
CREATE OR REPLACE FUNCTION update_asset_liability_links_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
