/*
  # Add missing columns to contacts table

  1. Changes
    - Add `status` column (text, default 'active')
    - Add `address` column (text)
    - Add `default_category_id` column (uuid, foreign key to categories)

  2. Data Migration
    - Set existing contacts to 'active' status
*/

-- Add missing columns to contacts table
ALTER TABLE contacts 
  ADD COLUMN IF NOT EXISTS status text DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS default_category_id uuid REFERENCES categories(id) ON DELETE SET NULL;

-- Update existing records to have active status
UPDATE contacts SET status = 'active' WHERE status IS NULL;
