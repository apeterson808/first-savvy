/*
  # Add display_name field to child_profiles

  1. Changes
    - Add `display_name` column to `child_profiles` table
    - This field will be nullable and defaults to NULL
    - When NULL, the application will display "first_name last_name"
    - When set, it overrides the default display name
  
  2. Notes
    - This allows parents to customize how their child's name appears
    - The display name is independent of first_name and last_name
    - Existing records will have NULL display_name, which means they'll use the default behavior
*/

-- Add display_name column to child_profiles
ALTER TABLE child_profiles 
ADD COLUMN IF NOT EXISTS display_name text;