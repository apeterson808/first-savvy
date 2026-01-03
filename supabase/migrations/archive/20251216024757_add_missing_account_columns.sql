/*
  # Add Missing Account Columns

  ## Overview
  This migration adds columns that are used by the application but are missing from the database schema.

  ## Changes Made

  ### 1. Bank Accounts Table
  - Add `parent_account_id` (uuid) - For sub-accounts
  - Add `start_date` (date) - Account opening date
  - Add `logo_url` (text) - Institution logo URL

  ### 2. Assets Table
  - Add `parent_account_id` (uuid) - For sub-assets
  - Add `institution` (text) - Institution name
  - Add `logo_url` (text) - Institution logo URL
  - Add `start_date` (date) - Asset start date
  - Add `description` (text) - Asset description

  ### 3. Liabilities Table
  - Add `parent_account_id` (uuid) - For sub-liabilities
  - Add `institution` (text) - Institution name
  - Add `logo_url` (text) - Institution logo URL
  - Add `start_date` (date) - Liability start date
  - Add `description` (text) - Liability description

  ### 4. Credit Cards Table
  - Add `parent_account_id` (uuid) - For sub-cards
  - Add `institution` (text) - Card issuer name
  - Add `logo_url` (text) - Card issuer logo URL

  ## Notes
  - All new columns are nullable to preserve existing data
  - Foreign keys reference their respective parent tables
*/

-- Add missing columns to bank_accounts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_accounts' AND column_name = 'parent_account_id'
  ) THEN
    ALTER TABLE bank_accounts ADD COLUMN parent_account_id uuid REFERENCES bank_accounts(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_accounts' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE bank_accounts ADD COLUMN start_date date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bank_accounts' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE bank_accounts ADD COLUMN logo_url text;
  END IF;
END $$;

-- Add missing columns to assets
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'parent_account_id'
  ) THEN
    ALTER TABLE assets ADD COLUMN parent_account_id uuid REFERENCES assets(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'institution'
  ) THEN
    ALTER TABLE assets ADD COLUMN institution text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE assets ADD COLUMN logo_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE assets ADD COLUMN start_date date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'assets' AND column_name = 'description'
  ) THEN
    ALTER TABLE assets ADD COLUMN description text;
  END IF;
END $$;

-- Add missing columns to liabilities
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'liabilities' AND column_name = 'parent_account_id'
  ) THEN
    ALTER TABLE liabilities ADD COLUMN parent_account_id uuid REFERENCES liabilities(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'liabilities' AND column_name = 'institution'
  ) THEN
    ALTER TABLE liabilities ADD COLUMN institution text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'liabilities' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE liabilities ADD COLUMN logo_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'liabilities' AND column_name = 'start_date'
  ) THEN
    ALTER TABLE liabilities ADD COLUMN start_date date;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'liabilities' AND column_name = 'description'
  ) THEN
    ALTER TABLE liabilities ADD COLUMN description text;
  END IF;
END $$;

-- Add missing columns to credit_cards
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_cards' AND column_name = 'parent_account_id'
  ) THEN
    ALTER TABLE credit_cards ADD COLUMN parent_account_id uuid REFERENCES credit_cards(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_cards' AND column_name = 'institution'
  ) THEN
    ALTER TABLE credit_cards ADD COLUMN institution text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_cards' AND column_name = 'logo_url'
  ) THEN
    ALTER TABLE credit_cards ADD COLUMN logo_url text;
  END IF;
END $$;