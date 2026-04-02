/*
  # Simplify Child Profile System to Single "Beginner" Type

  1. Changes
    - Remove Tiers 2 and 3 from permission_levels table
    - Remove Tier 2 and 3 features from permission_level_features table
    - Rename Tier 1 from "Basic Access" to "Beginner"
    - Migrate all child profiles to level 1 (Beginner)
    - Update constraints to only allow level 1
    - Update RLS policies to remove tier-based permissions
    - Archive level_transition_history table (preserve data but mark as historical)

  2. New System
    - Single profile type: "Beginner"
    - All child profiles operate at the same level
    - Features will be rebuilt from scratch for the Beginner type

  3. Security
    - Remove tier-based RLS policies
    - Parents retain full control over child profiles
    - Children cannot update their own profiles (removed tier 3 privilege)
*/

-- Step 1: Migrate all child profiles to level 1
UPDATE child_profiles
SET current_permission_level = 1
WHERE current_permission_level != 1;

-- Step 2: Archive level_transition_history by marking it as historical
-- (Preserving data but indicating the tier system is no longer active)
COMMENT ON TABLE level_transition_history IS 'ARCHIVED: Historical data from previous tier system. System now uses single Beginner profile type.';

-- Step 3: Delete Tier 2 and 3 from permission_levels
DELETE FROM permission_levels WHERE level_number IN (2, 3);

-- Step 4: Delete Tier 2 and 3 features from permission_level_features
DELETE FROM permission_level_features WHERE level_number IN (2, 3);

-- Step 5: Update Tier 1 to be named "Beginner"
UPDATE permission_levels
SET 
  level_name = 'Beginner',
  level_description = 'Basic child profile with access to tasks, rewards, and allowance tracking.',
  min_age_recommendation = 5
WHERE level_number = 1;

-- Step 6: Update constraints to only allow level 1
ALTER TABLE child_profiles
DROP CONSTRAINT IF EXISTS child_profiles_current_permission_level_check;

ALTER TABLE child_profiles
ADD CONSTRAINT child_profiles_current_permission_level_check
CHECK (current_permission_level = 1);

-- Step 7: Update permission_levels table constraint
ALTER TABLE permission_levels
DROP CONSTRAINT IF EXISTS permission_levels_level_number_check;

ALTER TABLE permission_levels
ADD CONSTRAINT permission_levels_level_number_check
CHECK (level_number = 1);

-- Step 8: Set default value for current_permission_level
ALTER TABLE child_profiles
ALTER COLUMN current_permission_level SET DEFAULT 1;

-- Step 9: Update RLS policy for child profile updates (remove tier-based logic)
DROP POLICY IF EXISTS "Users can update their child profiles" ON child_profiles;

CREATE POLICY "Users can update their child profiles"
  ON child_profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- Only parent can update child profiles (no child self-update)
    parent_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    OR
    owned_by_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    -- Same check for WITH CHECK clause
    parent_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    OR
    owned_by_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );
