/*
  # Create Simplified Alphabetical Category System

  1. New Tables
    - `category_templates` - Template categories for auto-provisioning to new users
      - id, name, type, detail_type, icon, color, parent_id, display_order, created_at

  2. Seeded Data
    - 3 income categories (alphabetically ordered): Gifts Received, Other Income, Salary
    - 16 expense categories (alphabetically ordered): Dining Out through Utilities
    - 2 transfer categories: Transfer (income and expense)
    - Total: 21 categories

  3. Functions
    - `copy_category_templates_to_user(user_id)` - Copies all template categories to a new user
    - `handle_new_user()` - Trigger function that provisions categories on signup

  4. Triggers
    - `on_auth_user_created` - Automatically provisions categories when a user signs up

  5. Security
    - No RLS on category_templates (system table)
    - Functions run with SECURITY DEFINER to bypass RLS when provisioning

  6. Notes
    - Categories are alphabetically ordered for easy scanning
    - Each category has intuitive icons and colors
    - New users automatically receive all categories on signup
*/

-- Create category templates table
CREATE TABLE IF NOT EXISTS category_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  detail_type text,
  icon text DEFAULT 'Circle',
  color text DEFAULT '#6b7280',
  parent_id uuid REFERENCES category_templates(id) ON DELETE CASCADE,
  display_order integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_category_templates_type ON category_templates(type);
CREATE INDEX IF NOT EXISTS idx_category_templates_parent_id ON category_templates(parent_id);
CREATE INDEX IF NOT EXISTS idx_category_templates_display_order ON category_templates(display_order);

-- Add table comment
COMMENT ON TABLE category_templates IS 'Template categories copied to new users on signup';

-- Income categories (3) - Alphabetically ordered
INSERT INTO category_templates (name, type, detail_type, icon, color, display_order) VALUES
  ('Gifts Received', 'income', 'income', 'Gift', '#10b981', 1),
  ('Other Income', 'income', 'income', 'Plus', '#059669', 2),
  ('Salary', 'income', 'income', 'Briefcase', '#047857', 3)
ON CONFLICT DO NOTHING;

-- Expense categories (16) - Alphabetically ordered
INSERT INTO category_templates (name, type, detail_type, icon, color, display_order) VALUES
  ('Dining Out', 'expense', 'expense', 'UtensilsCrossed', '#ef4444', 4),
  ('Education', 'expense', 'expense', 'GraduationCap', '#f97316', 5),
  ('Family & Kids', 'expense', 'expense', 'Users', '#f59e0b', 6),
  ('Financial', 'expense', 'expense', 'Landmark', '#eab308', 7),
  ('Giving', 'expense', 'expense', 'HandHeart', '#84cc16', 8),
  ('Groceries', 'expense', 'expense', 'ShoppingCart', '#22c55e', 9),
  ('Health & Wellness', 'expense', 'expense', 'HeartPulse', '#10b981', 10),
  ('Housing', 'expense', 'expense', 'Home', '#14b8a6', 11),
  ('Insurance', 'expense', 'expense', 'Shield', '#06b6d4', 12),
  ('Miscellaneous', 'expense', 'expense', 'MoreHorizontal', '#0ea5e9', 13),
  ('Personal & Lifestyle', 'expense', 'expense', 'Sparkles', '#3b82f6', 14),
  ('Subscriptions', 'expense', 'expense', 'Repeat', '#6366f1', 15),
  ('Taxes', 'expense', 'expense', 'Receipt', '#8b5cf6', 16),
  ('Transportation', 'expense', 'expense', 'Car', '#a855f7', 17),
  ('Travel', 'expense', 'expense', 'Plane', '#d946ef', 18),
  ('Utilities', 'expense', 'expense', 'Zap', '#ec4899', 19)
ON CONFLICT DO NOTHING;

-- Transfer categories (2)
INSERT INTO category_templates (name, type, detail_type, icon, color, display_order) VALUES
  ('Transfer', 'income', 'transfer', 'ArrowLeftRight', '#64748b', 20),
  ('Transfer', 'expense', 'transfer', 'ArrowLeftRight', '#64748b', 21)
ON CONFLICT DO NOTHING;

-- Function to copy category templates to a new user
CREATE OR REPLACE FUNCTION copy_category_templates_to_user(target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  categories_created integer;
BEGIN
  -- Copy all category templates to the new user's categories
  INSERT INTO categories (name, type, detail_type, icon, color, user_id, is_system)
  SELECT 
    name,
    type,
    detail_type,
    icon,
    color,
    target_user_id,
    false
  FROM category_templates
  ORDER BY display_order;

  GET DIAGNOSTICS categories_created = ROW_COUNT;
  
  RETURN categories_created;
END;
$$;

-- Trigger function that runs when a new user is created
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  categories_count integer;
BEGIN
  -- Copy category templates to the new user
  categories_count := copy_category_templates_to_user(NEW.id);
  
  -- Log the provisioning
  RAISE NOTICE 'Provisioned % categories for new user %', categories_count, NEW.id;
  
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users for automatic category provisioning
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- Add comments for documentation
COMMENT ON FUNCTION copy_category_templates_to_user IS 'Copies all category templates to a new user. Called automatically on user signup.';
COMMENT ON FUNCTION handle_new_user IS 'Trigger function that provisions categories for new users automatically.';