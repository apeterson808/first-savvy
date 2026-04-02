/*
  # Update Child Profile System to 3-Tier Model

  1. Changes
    - Update permission level constraint to allow only 1-3
    - Update RLS policies to use level 3 instead of 4+
    - Ensure all child profiles are within tier 1-3 range
    - Update permission_level_features table to only include tiers 1-3
    - Clean up any references to tiers 4-5

  2. Tier Definitions
    - Tier 1: Basic Access - Dashboard and chores only
    - Tier 2: Rewards - Can view and redeem rewards
    - Tier 3: Money - Full access to accounts, budgets, and financial data

  3. Security
    - Children at tier 3 can update their own profile
    - Parents always have full control regardless of tier
*/

-- Step 1: Downgrade any profiles at tier 4 or 5 to tier 3
UPDATE child_profiles
SET current_permission_level = 3
WHERE current_permission_level > 3;

-- Step 2: Remove tier 4 and 5 data from permission_levels
DELETE FROM permission_levels WHERE level_number > 3;

-- Step 3: Remove tier 4 and 5 features from permission_level_features
DELETE FROM permission_level_features WHERE level_number > 3;

-- Step 4: Update transition history to cap at tier 3
UPDATE level_transition_history
SET to_level = 3
WHERE to_level > 3;

UPDATE level_transition_history
SET from_level = 3
WHERE from_level > 3;

-- Step 5: Update the constraint on current_permission_level
ALTER TABLE child_profiles
DROP CONSTRAINT IF EXISTS child_profiles_current_permission_level_check;

ALTER TABLE child_profiles
ADD CONSTRAINT child_profiles_current_permission_level_check
CHECK (current_permission_level BETWEEN 1 AND 3);

-- Step 6: Update permission_levels table constraint
ALTER TABLE permission_levels
DROP CONSTRAINT IF EXISTS permission_levels_level_number_check;

ALTER TABLE permission_levels
ADD CONSTRAINT permission_levels_level_number_check
CHECK (level_number BETWEEN 1 AND 3);

-- Step 7: Update level_transition_history constraints
ALTER TABLE level_transition_history
DROP CONSTRAINT IF EXISTS level_transition_history_from_level_check;

ALTER TABLE level_transition_history
DROP CONSTRAINT IF EXISTS level_transition_history_to_level_check;

ALTER TABLE level_transition_history
ADD CONSTRAINT level_transition_history_from_level_check
CHECK (from_level BETWEEN 1 AND 3);

ALTER TABLE level_transition_history
ADD CONSTRAINT level_transition_history_to_level_check
CHECK (to_level BETWEEN 1 AND 3);

-- Step 8: Update RLS policy for child profile updates
DROP POLICY IF EXISTS "Users can update their child profiles" ON child_profiles;

CREATE POLICY "Users can update their child profiles"
  ON child_profiles
  FOR UPDATE
  TO authenticated
  USING (
    -- Parent owns the profile
    parent_profile_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
    OR
    -- Child with tier 3 (Money) can update their own profile
    (user_id = auth.uid() AND current_permission_level >= 3)
  );

-- Step 9: Ensure tier definitions are correct in permission_levels
DO $$
BEGIN
  -- Update or insert tier 1
  INSERT INTO permission_levels (level_number, level_name, level_description, min_age_recommendation)
  VALUES (
    1,
    'Basic Access',
    'Dashboard and chores only. Can view assigned chores and mark complete. Parent must approve all actions.',
    5
  )
  ON CONFLICT (level_number) DO UPDATE
  SET
    level_name = EXCLUDED.level_name,
    level_description = EXCLUDED.level_description,
    min_age_recommendation = EXCLUDED.min_age_recommendation;

  -- Update or insert tier 2
  INSERT INTO permission_levels (level_number, level_name, level_description, min_age_recommendation)
  VALUES (
    2,
    'Rewards',
    'Can view and redeem rewards. Can suggest chores and redeem rewards independently. Parent gets notifications.',
    8
  )
  ON CONFLICT (level_number) DO UPDATE
  SET
    level_name = EXCLUDED.level_name,
    level_description = EXCLUDED.level_description,
    min_age_recommendation = EXCLUDED.min_age_recommendation;

  -- Update or insert tier 3
  INSERT INTO permission_levels (level_number, level_name, level_description, min_age_recommendation)
  VALUES (
    3,
    'Money',
    'Full financial access. Can view accounts, budgets, create goals, access allowance tracking, and view all financial data.',
    13
  )
  ON CONFLICT (level_number) DO UPDATE
  SET
    level_name = EXCLUDED.level_name,
    level_description = EXCLUDED.level_description,
    min_age_recommendation = EXCLUDED.min_age_recommendation;
END $$;
