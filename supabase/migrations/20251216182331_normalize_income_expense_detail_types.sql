/*
  # Normalize Income and Expense Detail Types

  ## Overview
  Simplifies the category system by making detail_type match the type for income and expense categories.
  This allows users to have complete control over display names while keeping the data model simple.

  ## Changes Made
  1. Updates all income categories to have detail_type = 'income'
  2. Updates all expense categories to have detail_type = 'expense'
  3. Preserves existing name values (user's display names)
  
  ## Benefits
  - Simplifies category creation (no detail type selection needed)
  - Users have full control over category display names
  - AI matching becomes simpler (match on type + name)
  - Detail type truly becomes an internal field

  ## Important Notes
  - All existing category names are preserved
  - Only detail_type values are updated
  - This is a safe, non-destructive migration
*/

-- Update all income categories to have detail_type = 'income'
UPDATE categories
SET detail_type = 'income'
WHERE type = 'income';

-- Update all expense categories to have detail_type = 'expense'
UPDATE categories
SET detail_type = 'expense'
WHERE type = 'expense';