/*
  # Add Custom Name to Budgets

  1. Changes
    - Add custom_name column to budgets table (nullable)
    
  2. Purpose
    - Allow users to override chart account display name for budgets
    - Enables multiple budgets for same category (e.g., "Groceries Q1" vs "Groceries Q2")
    - Display logic: Use custom_name if set, otherwise fall back to chart account display_name
    
  3. Implementation Notes
    - Optional field - most budgets will use chart account name
    - No migration of existing data needed
    - UI will show custom_name with visual indicator if set
    
  4. Example Use Cases
    - Quarterly budgets: "Groceries Q1 2024"
    - Project-specific: "Vacation Fund - Hawaii"
    - Special tracking: "Holiday Shopping - December"
*/

-- Add custom_name column to budgets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budgets' AND column_name = 'custom_name'
  ) THEN
    ALTER TABLE budgets 
    ADD COLUMN custom_name TEXT NULL;
  END IF;
END $$;

-- Add comment explaining the field
COMMENT ON COLUMN budgets.custom_name IS 'Optional custom display name that overrides the linked chart account display_name. Allows users to create multiple budgets for the same category with distinct names.';
