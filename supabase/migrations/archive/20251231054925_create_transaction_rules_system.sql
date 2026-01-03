/*
  # Create Transaction Rules System
  
  ## Overview
  This migration creates a comprehensive transaction rules system that allows users to automate:
  1. **Categorization** - Automatically assign categories based on transaction description patterns
  2. **Contact Matching** - Automatically link transactions to vendors/customers based on patterns
  
  ## New Tables
  
  ### categorization_rules
  Stores user-defined rules for automatically categorizing transactions
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, references auth.users) - Rule owner
  - `profile_id` (uuid, references profiles) - Profile this rule belongs to
  - `name` (text) - Descriptive rule name (e.g., "Starbucks → Coffee")
  - `match_type` (text) - Type of matching: 'exact', 'contains', 'starts_with', 'ends_with'
  - `match_value` (text) - Pattern to match in transaction description
  - `category_account_id` (uuid, references user_chart_of_accounts) - Category to assign
  - `transaction_type` (text) - Optional filter: 'income', 'expense', 'all' (default all)
  - `priority` (integer) - Priority for rule evaluation (higher = evaluated first)
  - `is_active` (boolean) - Whether rule is currently active
  - `apply_to_existing` (boolean) - Whether to retroactively apply to existing transactions
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ### contact_matching_rules
  Stores user-defined rules for automatically matching transaction descriptions to contacts
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, references auth.users) - Rule owner
  - `profile_id` (uuid, references profiles) - Profile this rule belongs to
  - `name` (text) - Descriptive rule name (e.g., "Amazon payments")
  - `match_type` (text) - Type of matching: 'exact', 'contains', 'starts_with', 'ends_with'
  - `match_value` (text) - Pattern to match in transaction description
  - `contact_id` (uuid, references contacts) - Contact to assign when rule matches
  - `transaction_type` (text) - Optional filter: 'income', 'expense', 'all' (default all)
  - `priority` (integer) - Priority for rule evaluation (higher = evaluated first)
  - `is_active` (boolean) - Whether rule is currently active
  - `apply_to_existing` (boolean) - Whether to retroactively apply to existing transactions
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp
  
  ## Security
  - Enable RLS on both tables
  - Add policies for authenticated users to manage their own rules within their profiles
  - Ensure rules can only reference resources within the same profile
  
  ## Indexes
  - Create indexes on user_id and profile_id for fast lookups
  - Create compound indexes on (profile_id, is_active) for active rule lookups
  - Create indexes on foreign keys (category_account_id, contact_id)
  
  ## Important Notes
  1. Rules are evaluated in priority order (highest first)
  2. First matching rule wins (no rule chaining)
  3. Inactive rules are ignored during matching
  4. Users can only create rules for resources in their own profiles
  5. apply_to_existing flag determines if rule applies to past transactions
*/

-- Create categorization_rules table
CREATE TABLE IF NOT EXISTS categorization_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  match_type text NOT NULL DEFAULT 'contains',
  match_value text NOT NULL,
  category_account_id uuid REFERENCES user_chart_of_accounts(id) ON DELETE CASCADE NOT NULL,
  transaction_type text DEFAULT 'all',
  priority integer DEFAULT 0,
  is_active boolean DEFAULT true,
  apply_to_existing boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add check constraint for categorization match_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'categorization_rules_match_type_check'
  ) THEN
    ALTER TABLE categorization_rules 
    ADD CONSTRAINT categorization_rules_match_type_check 
    CHECK (match_type IN ('exact', 'contains', 'starts_with', 'ends_with', 'regex'));
  END IF;
END $$;

-- Add check constraint for categorization transaction_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'categorization_rules_transaction_type_check'
  ) THEN
    ALTER TABLE categorization_rules 
    ADD CONSTRAINT categorization_rules_transaction_type_check 
    CHECK (transaction_type IN ('income', 'expense', 'all'));
  END IF;
END $$;

-- Create contact_matching_rules table
CREATE TABLE IF NOT EXISTS contact_matching_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  profile_id uuid REFERENCES profiles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  match_type text NOT NULL DEFAULT 'contains',
  match_value text NOT NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  transaction_type text DEFAULT 'all',
  priority integer DEFAULT 0,
  is_active boolean DEFAULT true,
  apply_to_existing boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add check constraint for contact matching match_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contact_matching_rules_match_type_check'
  ) THEN
    ALTER TABLE contact_matching_rules 
    ADD CONSTRAINT contact_matching_rules_match_type_check 
    CHECK (match_type IN ('exact', 'contains', 'starts_with', 'ends_with', 'regex'));
  END IF;
END $$;

-- Add check constraint for contact matching transaction_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contact_matching_rules_transaction_type_check'
  ) THEN
    ALTER TABLE contact_matching_rules 
    ADD CONSTRAINT contact_matching_rules_transaction_type_check 
    CHECK (transaction_type IN ('income', 'expense', 'all'));
  END IF;
END $$;

-- Enable Row Level Security
ALTER TABLE categorization_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_matching_rules ENABLE ROW LEVEL SECURITY;

-- Create indexes for categorization_rules
CREATE INDEX IF NOT EXISTS idx_categorization_rules_user_id 
  ON categorization_rules(user_id);

CREATE INDEX IF NOT EXISTS idx_categorization_rules_profile_id 
  ON categorization_rules(profile_id);

CREATE INDEX IF NOT EXISTS idx_categorization_rules_profile_active 
  ON categorization_rules(profile_id, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_categorization_rules_category_id 
  ON categorization_rules(category_account_id);

-- Create indexes for contact_matching_rules
CREATE INDEX IF NOT EXISTS idx_contact_matching_rules_user_id 
  ON contact_matching_rules(user_id);

CREATE INDEX IF NOT EXISTS idx_contact_matching_rules_profile_id 
  ON contact_matching_rules(profile_id);

CREATE INDEX IF NOT EXISTS idx_contact_matching_rules_profile_active 
  ON contact_matching_rules(profile_id, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_contact_matching_rules_contact_id 
  ON contact_matching_rules(contact_id);

-- RLS Policies for categorization_rules
CREATE POLICY "Users can view own categorization rules"
  ON categorization_rules FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profile_memberships 
      WHERE profile_memberships.profile_id = categorization_rules.profile_id 
      AND profile_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create categorization rules in their profiles"
  ON categorization_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profile_memberships 
      WHERE profile_memberships.profile_id = categorization_rules.profile_id 
      AND profile_memberships.user_id = auth.uid()
      AND profile_memberships.role IN ('owner', 'admin', 'member')
    )
    AND EXISTS (
      SELECT 1 FROM user_chart_of_accounts 
      WHERE user_chart_of_accounts.id = category_account_id 
      AND user_chart_of_accounts.profile_id = categorization_rules.profile_id
    )
  );

CREATE POLICY "Users can update own categorization rules"
  ON categorization_rules FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profile_memberships 
      WHERE profile_memberships.profile_id = categorization_rules.profile_id 
      AND profile_memberships.user_id = auth.uid()
      AND profile_memberships.role IN ('owner', 'admin', 'member')
    )
  )
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profile_memberships 
      WHERE profile_memberships.profile_id = categorization_rules.profile_id 
      AND profile_memberships.user_id = auth.uid()
      AND profile_memberships.role IN ('owner', 'admin', 'member')
    )
    AND EXISTS (
      SELECT 1 FROM user_chart_of_accounts 
      WHERE user_chart_of_accounts.id = category_account_id 
      AND user_chart_of_accounts.profile_id = categorization_rules.profile_id
    )
  );

CREATE POLICY "Users can delete own categorization rules"
  ON categorization_rules FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profile_memberships 
      WHERE profile_memberships.profile_id = categorization_rules.profile_id 
      AND profile_memberships.user_id = auth.uid()
      AND profile_memberships.role IN ('owner', 'admin', 'member')
    )
  );

-- RLS Policies for contact_matching_rules
CREATE POLICY "Users can view own contact matching rules"
  ON contact_matching_rules FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profile_memberships 
      WHERE profile_memberships.profile_id = contact_matching_rules.profile_id 
      AND profile_memberships.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create contact matching rules in their profiles"
  ON contact_matching_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profile_memberships 
      WHERE profile_memberships.profile_id = contact_matching_rules.profile_id 
      AND profile_memberships.user_id = auth.uid()
      AND profile_memberships.role IN ('owner', 'admin', 'member')
    )
    AND EXISTS (
      SELECT 1 FROM contacts 
      WHERE contacts.id = contact_id 
      AND contacts.profile_id = contact_matching_rules.profile_id
    )
  );

CREATE POLICY "Users can update own contact matching rules"
  ON contact_matching_rules FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profile_memberships 
      WHERE profile_memberships.profile_id = contact_matching_rules.profile_id 
      AND profile_memberships.user_id = auth.uid()
      AND profile_memberships.role IN ('owner', 'admin', 'member')
    )
  )
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profile_memberships 
      WHERE profile_memberships.profile_id = contact_matching_rules.profile_id 
      AND profile_memberships.user_id = auth.uid()
      AND profile_memberships.role IN ('owner', 'admin', 'member')
    )
    AND EXISTS (
      SELECT 1 FROM contacts 
      WHERE contacts.id = contact_id 
      AND contacts.profile_id = contact_matching_rules.profile_id
    )
  );

CREATE POLICY "Users can delete own contact matching rules"
  ON contact_matching_rules FOR DELETE
  TO authenticated
  USING (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM profile_memberships 
      WHERE profile_memberships.profile_id = contact_matching_rules.profile_id 
      AND profile_memberships.user_id = auth.uid()
      AND profile_memberships.role IN ('owner', 'admin', 'member')
    )
  );

-- Create triggers to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_categorization_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_contact_matching_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS categorization_rules_updated_at ON categorization_rules;
DROP TRIGGER IF EXISTS contact_matching_rules_updated_at ON contact_matching_rules;

CREATE TRIGGER categorization_rules_updated_at
  BEFORE UPDATE ON categorization_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_categorization_rules_updated_at();

CREATE TRIGGER contact_matching_rules_updated_at
  BEFORE UPDATE ON contact_matching_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_matching_rules_updated_at();