/*
  # Create Account Classification Templates System

  ## Overview
  This migration creates a protected system-wide account classification template system
  that defines the master list of all possible account types across Assets, Liabilities,
  Income, Expenses, and Equity categories. This table is never directly accessed by users.

  ## Structure
  - **class**: Top-level category (asset, liability, income, expense, equity)
  - **type**: Mid-level grouping (e.g., "cash", "bank accounts", "credit card")
  - **category**: Specific classification (e.g., "physical cash", "checking", "personal credit card")
  - **display_order**: Controls sort order in UI
  - **is_active**: Allows deprecation without deletion

  ## Security
  - NO RLS policies - this is a protected system table
  - Users never directly access this table
  - Only database triggers and admin functions read from it
  - Provides immutable master data for user-specific copies

  ## Usage
  New users automatically receive a copy of all classifications in their
  own account_classifications table via the auto-provisioning trigger.
*/

CREATE TABLE IF NOT EXISTS account_classification_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class text NOT NULL CHECK (class IN ('asset', 'liability', 'income', 'expense', 'equity')),
  type text NOT NULL,
  category text NOT NULL,
  display_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),

  -- Ensure uniqueness of class + type + category combination
  UNIQUE(class, type, category)
);

-- Add indexes for efficient querying during user provisioning
CREATE INDEX IF NOT EXISTS idx_account_classification_templates_class
  ON account_classification_templates(class);
CREATE INDEX IF NOT EXISTS idx_account_classification_templates_type
  ON account_classification_templates(type);
CREATE INDEX IF NOT EXISTS idx_account_classification_templates_class_type
  ON account_classification_templates(class, type);

-- Add table documentation
COMMENT ON TABLE account_classification_templates IS 'Protected system table containing master account classifications. Copied to users on signup. Never directly accessed by users.';
COMMENT ON COLUMN account_classification_templates.class IS 'Top-level category: asset, liability, income, expense, equity (not user-editable)';
COMMENT ON COLUMN account_classification_templates.type IS 'Mid-level grouping (not user-editable)';
COMMENT ON COLUMN account_classification_templates.category IS 'Specific classification name (user can customize display via their own copy)';
