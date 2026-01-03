/*
  # Simplify Profile Tabs Schema

  ## Overview
  Removes redundant columns from profile_tabs table.
  The profile_id foreign key already provides all needed information via JOIN.

  ## Changes
  1. Remove profile_user_id column (redundant with profile_id → profiles → user_id)
  2. Remove profile_name column (can get from profiles.display_name via JOIN)
  3. Create helper view v_profile_tabs_display for convenient querying
  
  ## Rationale
  - Eliminates data duplication
  - Single source of truth: profiles table
  - Cleaner schema with fewer columns to maintain
*/

-- ============================================================================
-- Step 1: Drop redundant columns
-- ============================================================================

-- Drop profile_user_id (can get via profile_id → profiles → user_id)
ALTER TABLE profile_tabs DROP COLUMN IF EXISTS profile_user_id;

-- Drop profile_name (can get via profile_id → profiles → display_name)
ALTER TABLE profile_tabs DROP COLUMN IF EXISTS profile_name;

-- ============================================================================
-- Step 2: Create helper view for convenient querying
-- ============================================================================

-- Drop existing view if it exists
DROP VIEW IF EXISTS v_profile_tabs_display CASCADE;

-- Create enriched view with JOINed data
CREATE OR REPLACE VIEW v_profile_tabs_display AS
SELECT
  pt.id,
  pt.owner_user_id,
  pt.profile_id,
  pt.profile_type,
  pt.profile_metadata,
  pt.tab_order,
  pt.is_active,
  pt.state_data,
  pt.display_name as custom_display_name,
  pt.last_accessed_at,
  pt.created_at,
  pt.updated_at,
  -- Enriched data from joins
  p.display_name as profile_display_name,
  p.profile_type as profile_profile_type,
  p.user_id as profile_owner_user_id,
  us.full_name as owner_full_name,
  us.email as owner_email,
  -- Computed effective display name
  COALESCE(pt.display_name, p.display_name, us.full_name) as effective_display_name
FROM profile_tabs pt
LEFT JOIN profiles p ON pt.profile_id = p.id
LEFT JOIN user_settings us ON pt.owner_user_id = us.id;

COMMENT ON VIEW v_profile_tabs_display IS 'Profile tabs with enriched display data from profiles and user_settings. Use this view for UI display to avoid manual JOINs.';

-- ============================================================================
-- Step 3: Update table comments
-- ============================================================================

COMMENT ON TABLE profile_tabs IS 'Browser-like tab system for switching between multiple profiles. Simplified schema with no redundant columns.';
COMMENT ON COLUMN profile_tabs.profile_id IS 'Foreign key to profiles. Get profile details via JOIN, not duplicated columns.';
COMMENT ON COLUMN profile_tabs.display_name IS 'Optional custom display name for this tab. If null, use profiles.display_name instead.';
