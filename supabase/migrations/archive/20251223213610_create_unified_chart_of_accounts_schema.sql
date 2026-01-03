/*
  # Create Unified Chart of Accounts System

  ## Overview
  This migration creates a unified chart of accounts system to replace the fragmented
  categories, assets, liabilities, and equity tables with a professional accounting structure.

  ## New Tables
  
  ### `chart_of_accounts_templates`
  Template definitions for the standard 81-account chart of accounts.
  - `account_number` (integer, primary key) - Unique account number (1000-5999)
  - `account_type` (text) - One of: asset, liability, equity, income, expense
  - `account_detail` (text, nullable) - Level 2 classification (e.g., "cash", "bank accounts")
  - `category` (text, nullable) - Level 3/4 classification (e.g., "checking", "savings")
  - `display_name_default` (text) - Default display name for the account
  - `icon` (text, nullable) - Icon identifier for UI display
  - `color` (text, nullable) - Color hex code for UI display
  - `is_editable` (boolean) - Whether users can edit this account's display name
  - `level` (integer) - Hierarchy level (1-4)
  - `parent_account_number` (integer, nullable) - Reference to parent account
  - `number_range_start` (integer, nullable) - Start of range for user-created accounts
  - `number_range_end` (integer, nullable) - End of range for user-created accounts
  - `sort_order` (integer) - Order within same parent
  - `created_at` (timestamptz)

  ### `user_chart_of_accounts`
  User-specific chart of accounts with customizations and user-created accounts.
  - `id` (uuid, primary key)
  - `user_id` (uuid) - Reference to auth.users
  - `template_account_number` (integer, nullable) - Reference to template (null for user-created)
  - `account_number` (integer) - User's actual account number
  - `custom_display_name` (text, nullable) - User's custom display name
  - `account_type` (text) - One of: asset, liability, equity, income, expense
  - `account_detail` (text, nullable) - Level 2 classification
  - `category` (text, nullable) - Level 3/4 classification
  - `icon` (text, nullable) - Icon identifier
  - `color` (text, nullable) - Color hex code
  - `is_active` (boolean) - Whether account is currently active
  - `is_user_created` (boolean) - Whether user created this account
  - `level` (integer) - Hierarchy level
  - `parent_account_number` (integer, nullable) - Reference to parent
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ## Security
  - Enable RLS on both tables
  - chart_of_accounts_templates: Read-only for all authenticated users
  - user_chart_of_accounts: Users can only access their own accounts

  ## Indexes
  - Foreign key indexes for performance
  - Account number uniqueness per user
  - Quick lookups by account type and active status
*/

-- Create chart_of_accounts_templates table
CREATE TABLE IF NOT EXISTS chart_of_accounts_templates (
  account_number integer PRIMARY KEY,
  account_type text NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  account_detail text,
  category text,
  display_name_default text NOT NULL,
  icon text,
  color text,
  is_editable boolean DEFAULT false,
  level integer NOT NULL CHECK (level BETWEEN 1 AND 4),
  parent_account_number integer REFERENCES chart_of_accounts_templates(account_number),
  number_range_start integer,
  number_range_end integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Create user_chart_of_accounts table
CREATE TABLE IF NOT EXISTS user_chart_of_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_account_number integer REFERENCES chart_of_accounts_templates(account_number),
  account_number integer NOT NULL,
  custom_display_name text,
  account_type text NOT NULL CHECK (account_type IN ('asset', 'liability', 'equity', 'income', 'expense')),
  account_detail text,
  category text,
  icon text,
  color text,
  is_active boolean DEFAULT true,
  is_user_created boolean DEFAULT false,
  level integer NOT NULL CHECK (level BETWEEN 1 AND 4),
  parent_account_number integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_coa_templates_account_type ON chart_of_accounts_templates(account_type);
CREATE INDEX IF NOT EXISTS idx_coa_templates_parent ON chart_of_accounts_templates(parent_account_number);
CREATE INDEX IF NOT EXISTS idx_user_coa_user_id ON user_chart_of_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_user_coa_template ON user_chart_of_accounts(template_account_number);
CREATE INDEX IF NOT EXISTS idx_user_coa_account_type ON user_chart_of_accounts(account_type);
CREATE INDEX IF NOT EXISTS idx_user_coa_active ON user_chart_of_accounts(user_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_coa_unique_number ON user_chart_of_accounts(user_id, account_number);

-- Enable RLS
ALTER TABLE chart_of_accounts_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for chart_of_accounts_templates (read-only for all authenticated users)
CREATE POLICY "Authenticated users can view chart of accounts templates"
  ON chart_of_accounts_templates FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for user_chart_of_accounts
CREATE POLICY "Users can view own chart of accounts"
  ON user_chart_of_accounts FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own chart of accounts"
  ON user_chart_of_accounts FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own chart of accounts"
  ON user_chart_of_accounts FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own chart of accounts"
  ON user_chart_of_accounts FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_user_chart_of_accounts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER update_user_chart_of_accounts_updated_at
  BEFORE UPDATE ON user_chart_of_accounts
  FOR EACH ROW
  EXECUTE FUNCTION update_user_chart_of_accounts_updated_at();