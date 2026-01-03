/*
  # Fix Transfer Registry Foreign Key Constraint

  ## Overview
  The transfer_registry table was created with a foreign key constraint
  referencing 'user_profiles(id)', but the actual table name is 'profiles'.
  This migration fixes the constraint to reference the correct table.

  ## Changes
  1. Drop the incorrect foreign key constraint
  2. Add the correct foreign key constraint referencing profiles(id)

  ## Impact
  - Fixes 409 constraint violation errors when inserting transfer registry entries
  - Ensures data integrity with proper foreign key relationships
*/

-- Drop the incorrect foreign key constraint
ALTER TABLE transfer_registry
DROP CONSTRAINT IF EXISTS transfer_registry_profile_id_fkey;

-- Add the correct foreign key constraint
ALTER TABLE transfer_registry
ADD CONSTRAINT transfer_registry_profile_id_fkey
FOREIGN KEY (profile_id)
REFERENCES profiles(id)
ON DELETE CASCADE;
