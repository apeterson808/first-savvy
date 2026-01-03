/*
  # Remove Clearbit Logo URLs

  1. Changes
    - Set all `logo_url` values to NULL in financial_institutions table
    - This prevents failed network requests to logo.clearbit.com
    - The UI already has fallback icons (Building2) that display when logo_url is null

  2. Notes
    - Clearbit's logo API is no longer accessible
    - The BankInstitutionSearch component gracefully handles missing logos
*/

-- Update all logo URLs to NULL to prevent failed network requests
UPDATE financial_institutions
SET logo_url = NULL
WHERE logo_url LIKE '%clearbit.com%';
