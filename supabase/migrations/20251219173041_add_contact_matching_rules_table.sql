/*
  # Create Contact Matching Rules Table

  ## Overview
  This migration adds intelligent contact matching rules that allow users to create
  patterns for automatically assigning contacts to transactions based on description matching.
  This mirrors the categorization_rules functionality for contacts.

  ## New Tables
  
  ### contact_matching_rules
  Stores user-defined rules for automatically matching transaction descriptions to contacts
  - `id` (uuid, primary key) - Unique identifier
  - `user_id` (uuid, references auth.users) - Rule owner
  - `name` (text) - Descriptive rule name (e.g., "Amazon payments")
  - `match_type` (text) - Type of matching: 'exact', 'contains', 'starts_with', 'ends_with'
  - `match_value` (text) - Pattern to match in transaction description
  - `contact_id` (uuid, references contacts) - Contact to assign when rule matches
  - `transaction_type` (text) - Optional filter: 'income', 'expense', 'all' (default all)
  - `priority` (integer) - Priority for rule evaluation (higher = evaluated first)
  - `is_active` (boolean) - Whether rule is currently active
  - `created_at` (timestamptz) - Creation timestamp
  - `updated_at` (timestamptz) - Last update timestamp

  ## Security
  - Enable RLS on contact_matching_rules table
  - Add policies for authenticated users to manage their own rules
  - Ensure rules can only reference user's own contacts

  ## Indexes
  - Create index on user_id for fast user-specific queries
  - Create compound index on (user_id, is_active) for active rule lookups
  - Create index on contact_id for foreign key performance

  ## Important Notes
  1. Rules are evaluated in priority order (highest first)
  2. First matching rule wins (no rule chaining)
  3. Inactive rules are ignored during matching
  4. Users can only create rules for their own contacts
*/

-- Create contact_matching_rules table
CREATE TABLE IF NOT EXISTS contact_matching_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  match_type text NOT NULL DEFAULT 'contains',
  match_value text NOT NULL,
  contact_id uuid REFERENCES contacts(id) ON DELETE CASCADE NOT NULL,
  transaction_type text DEFAULT 'all',
  priority integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add check constraint for match_type
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'contact_matching_rules_match_type_check'
  ) THEN
    ALTER TABLE contact_matching_rules 
    ADD CONSTRAINT contact_matching_rules_match_type_check 
    CHECK (match_type IN ('exact', 'contains', 'starts_with', 'ends_with'));
  END IF;
END $$;

-- Add check constraint for transaction_type
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
ALTER TABLE contact_matching_rules ENABLE ROW LEVEL SECURITY;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_contact_matching_rules_user_id 
  ON contact_matching_rules(user_id);

CREATE INDEX IF NOT EXISTS idx_contact_matching_rules_user_active 
  ON contact_matching_rules(user_id, is_active) 
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_contact_matching_rules_contact_id 
  ON contact_matching_rules(contact_id);

-- RLS Policies
CREATE POLICY "Users can view own contact matching rules"
  ON contact_matching_rules FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own contact matching rules"
  ON contact_matching_rules FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM contacts 
      WHERE contacts.id = contact_id 
      AND contacts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own contact matching rules"
  ON contact_matching_rules FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id 
    AND EXISTS (
      SELECT 1 FROM contacts 
      WHERE contacts.id = contact_id 
      AND contacts.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own contact matching rules"
  ON contact_matching_rules FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_contact_matching_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS contact_matching_rules_updated_at ON contact_matching_rules;

CREATE TRIGGER contact_matching_rules_updated_at
  BEFORE UPDATE ON contact_matching_rules
  FOR EACH ROW
  EXECUTE FUNCTION update_contact_matching_rules_updated_at();