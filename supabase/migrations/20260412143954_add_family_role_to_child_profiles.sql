/*
  # Add family_role to child_profiles

  ## Summary
  Adds a `family_role` column to the `child_profiles` table to distinguish the
  relationship type of each family member. This enables different permission
  tiers and invite flows for children vs. adult family members.

  ## Changes

  ### Modified Tables
  - `child_profiles`
    - `family_role` (text, default 'child') — the relationship of this member to
      the account owner. Allowed values:
        child | spouse_partner | parent | sibling | grandparent | other

  ## Notes
  1. All existing rows default to 'child' so no data is affected.
  2. A CHECK constraint enforces the allowed values.
  3. An index is added for future permission-level queries filtered by role.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'child_profiles' AND column_name = 'family_role'
  ) THEN
    ALTER TABLE child_profiles
      ADD COLUMN family_role text NOT NULL DEFAULT 'child'
        CHECK (family_role IN ('child', 'spouse_partner', 'parent', 'sibling', 'grandparent', 'other'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_child_profiles_family_role ON child_profiles(family_role);
