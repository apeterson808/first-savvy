/*
  # Add icon column to budgets table

  1. Changes
    - Add `icon` column to budgets table to store the icon name
    - Icon names correspond to Lucide React icon names (e.g., 'DollarSign', 'Utensils', 'ShoppingCart')
  
  2. Notes
    - This allows each budget to have a visual icon representation
    - Icons are optional and will default to 'Circle' if not set
*/

ALTER TABLE budgets ADD COLUMN IF NOT EXISTS icon text;
