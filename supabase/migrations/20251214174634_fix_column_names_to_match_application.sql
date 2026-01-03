/*
  # Fix Column Names to Match Application Code

  ## Overview
  This migration renames columns in several tables to match the expected column names used throughout the application code.

  ## Changes Made

  ### 1. Bank Accounts Table
  - Rename `name` → `account_name`
  - Rename `type` → `account_type`
  - Rename `balance` → `current_balance`

  ### 2. Assets Table
  - Rename `value` → `current_value`

  ### 3. Liabilities Table
  - Rename `balance` → `current_balance`

  ### 4. Credit Scores Table
  - Rename `date` → `last_checked`

  ### 5. Categories Table
  - Add `detail_type` column for category subtypes

  ## Notes
  - All column renames preserve existing data
  - Changes are backwards compatible with Supabase RLS policies
*/

-- Fix bank_accounts table
ALTER TABLE bank_accounts 
  RENAME COLUMN name TO account_name;

ALTER TABLE bank_accounts 
  RENAME COLUMN type TO account_type;

ALTER TABLE bank_accounts 
  RENAME COLUMN balance TO current_balance;

-- Fix assets table
ALTER TABLE assets 
  RENAME COLUMN value TO current_value;

-- Fix liabilities table
ALTER TABLE liabilities 
  RENAME COLUMN balance TO current_balance;

-- Fix credit_scores table
ALTER TABLE credit_scores 
  RENAME COLUMN date TO last_checked;

-- Add detail_type to categories table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'detail_type'
  ) THEN
    ALTER TABLE categories ADD COLUMN detail_type text;
  END IF;
END $$;

-- Add is_active to categories if not exists (should already exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'categories' AND column_name = 'is_active'
  ) THEN
    ALTER TABLE categories ADD COLUMN is_active boolean DEFAULT true;
  END IF;
END $$;