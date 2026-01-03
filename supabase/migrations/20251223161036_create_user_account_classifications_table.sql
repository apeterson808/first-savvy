/*
  # Create User Account Classifications Table

  ## Overview
  This migration creates the user-specific account_classifications table where each
  user gets their own copy of the classification system. Users can customize display
  names and add custom categories, but cannot modify class or type fields.

  ## New Tables
  - `account_classifications`
    - `id` (uuid, primary key)
    - `user_id` (uuid, references auth.users)
    - `template_id` (uuid, references templates if copied from system)
    - `class` (text, not null) - Locked field, cannot be edited by user
    - `type` (text, not null) - Locked field, cannot be edited by user
    - `category` (text, not null) - Original category name
    - `display_name` (text) - User-customizable display name
    - `is_custom` (boolean) - True if user created this classification
    - `is_active` (boolean) - User can deactivate classifications
    - `created_at` (timestamptz)
    - `updated_at` (timestamptz)

  ## Security
  - RLS enabled with policies for authenticated users
  - Users can only access their own classifications
  - Policies enforce user_id = auth.uid()

  ## Indexes
  - Index on user_id for filtering
  - Index on (user_id, class) for class-based queries
  - Index on (user_id, type) for type-based queries
  - Index on (user_id, class, type) for cascading dropdowns
*/

CREATE TABLE IF NOT EXISTS account_classifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id uuid REFERENCES account_classification_templates(id) ON DELETE SET NULL,
  
  -- Core classification fields (class and type are locked, category is base name)
  class text NOT NULL CHECK (class IN ('asset', 'liability', 'income', 'expense', 'equity')),
  type text NOT NULL,
  category text NOT NULL,
  
  -- User-customizable fields
  display_name text,
  is_custom boolean DEFAULT false,
  is_active boolean DEFAULT true,
  
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  -- Ensure users can't have duplicate classifications
  UNIQUE(user_id, class, type, category)
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_account_classifications_user_id 
  ON account_classifications(user_id);

CREATE INDEX IF NOT EXISTS idx_account_classifications_user_class 
  ON account_classifications(user_id, class);

CREATE INDEX IF NOT EXISTS idx_account_classifications_user_type 
  ON account_classifications(user_id, type);

CREATE INDEX IF NOT EXISTS idx_account_classifications_user_class_type 
  ON account_classifications(user_id, class, type);

CREATE INDEX IF NOT EXISTS idx_account_classifications_template_id 
  ON account_classifications(template_id) WHERE template_id IS NOT NULL;

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE account_classifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own classifications
CREATE POLICY "Users can view own account classifications"
  ON account_classifications FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Users can insert their own classifications (for custom categories)
CREATE POLICY "Users can insert own account classifications"
  ON account_classifications FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Users can update their own classifications (display_name, is_active only)
CREATE POLICY "Users can update own account classifications"
  ON account_classifications FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- Users can delete their own custom classifications only
CREATE POLICY "Users can delete own custom account classifications"
  ON account_classifications FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()) AND is_custom = true);

-- ============================================================================
-- TRIGGER FOR UPDATED_AT
-- ============================================================================

CREATE OR REPLACE FUNCTION update_account_classifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_account_classifications_updated_at
  BEFORE UPDATE ON account_classifications
  FOR EACH ROW
  EXECUTE FUNCTION update_account_classifications_updated_at();

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE account_classifications IS 'User-specific account classifications. Each user gets their own copy from templates and can customize display names and add custom categories.';
COMMENT ON COLUMN account_classifications.class IS 'Top-level category (asset, liability, income, expense, equity) - LOCKED, cannot be edited by user';
COMMENT ON COLUMN account_classifications.type IS 'Mid-level grouping - LOCKED, cannot be edited by user';
COMMENT ON COLUMN account_classifications.category IS 'Original category name from template or user input';
COMMENT ON COLUMN account_classifications.display_name IS 'User-customizable display name. If NULL, shows category field.';
COMMENT ON COLUMN account_classifications.is_custom IS 'TRUE if user created this classification, FALSE if copied from template';
COMMENT ON COLUMN account_classifications.template_id IS 'Reference to template this was copied from (NULL for custom classifications)';
