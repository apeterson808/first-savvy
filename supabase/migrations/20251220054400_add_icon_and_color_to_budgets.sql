/*
  # Add Icon and Color Columns to Budgets Table

  ## Changes
  1. Add `icon` column to budgets table
     - Stores the Lucide icon name (e.g., 'ShoppingCart', 'Coffee')
     - Defaults to 'DollarSign'
  
  2. Add `color` column to budgets table
     - Stores the hex color code for the budget item
     - Defaults to '#6B7280' (gray)
  
  3. Add `order` column to budgets table
     - Controls display order within a group
     - Defaults to 0

  ## Purpose
  These columns allow budget items to have custom visual representations
  with icons and colors that match their categories or user preferences.
*/

-- Add icon column to budgets table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'budgets' AND column_name = 'icon'
  ) THEN
    ALTER TABLE budgets ADD COLUMN icon text DEFAULT 'DollarSign';
  END IF;
END $$;

-- Add color column to budgets table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'budgets' AND column_name = 'color'
  ) THEN
    ALTER TABLE budgets ADD COLUMN color text DEFAULT '#6B7280';
  END IF;
END $$;

-- Add order column to budgets table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'budgets' AND column_name = 'order'
  ) THEN
    ALTER TABLE budgets ADD COLUMN "order" integer DEFAULT 0;
  END IF;
END $$;

-- Update existing budgets to inherit icon and color from their categories (if they exist)
UPDATE budgets b
SET 
  icon = COALESCE(c.icon, 'DollarSign'),
  color = COALESCE(c.color, '#6B7280')
FROM categories c
WHERE b.category_id = c.id
  AND (b.icon IS NULL OR b.icon = 'DollarSign')
  AND (b.color IS NULL OR b.color = '#6B7280');