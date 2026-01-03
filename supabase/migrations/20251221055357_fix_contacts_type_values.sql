/*
  # Fix Contacts Type Values

  ## Overview
  Updates the contacts table type constraint to allow 'vendor' and 'customer'
  values instead of 'person' and 'business', matching the frontend form.

  ## Changes
    - Drop existing contacts_type_check constraint
    - Add new constraint allowing 'vendor' and 'customer' values
    - These values better represent financial contacts (merchants, service providers, employers, etc.)

  ## Security
    No RLS changes needed
*/

-- Drop the old constraint
ALTER TABLE contacts DROP CONSTRAINT IF EXISTS contacts_type_check;

-- Add new constraint with vendor/customer values
ALTER TABLE contacts 
  ADD CONSTRAINT contacts_type_check 
  CHECK (type IN ('vendor', 'customer'));