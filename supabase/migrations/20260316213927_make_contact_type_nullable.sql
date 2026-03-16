/*
  # Make contact type column nullable

  1. Changes
    - Drop the CHECK constraint on the contacts.type column
    - Make the contacts.type column nullable by removing NOT NULL constraint
    
  2. Reasoning
    - Contact type is no longer a required field in the application
    - Existing contacts can have null type values
    - This allows for more flexible contact management without forcing categorization
*/

-- Drop the CHECK constraint if it exists
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'contacts_type_check'
    AND table_name = 'contacts'
  ) THEN
    ALTER TABLE contacts DROP CONSTRAINT contacts_type_check;
  END IF;
END $$;

-- Make the type column nullable
ALTER TABLE contacts ALTER COLUMN type DROP NOT NULL;
