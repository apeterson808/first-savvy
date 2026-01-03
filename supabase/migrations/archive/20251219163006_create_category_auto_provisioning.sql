/*
  # Create Category Auto-Provisioning System

  1. New Functions
    - `copy_category_templates_to_user(user_id uuid)` - Copies all template categories to a new user
    - Returns the number of categories created

  2. New Triggers
    - `on_auth_user_created` - Automatically provisions categories when a user signs up
    - Fires after insert on auth.users table

  3. Security
    - Function executes with SECURITY DEFINER to bypass RLS
    - Only copies from category_templates (read-only system table)
    - Inserts into categories with proper user_id ownership

  4. Important Notes
    - This eliminates the need for manual category seeding
    - Each user gets their own complete set of categories
    - Categories are independent per user (no sharing)
    - Runs automatically and transparently on signup
*/

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
  
  -- Log the provisioning (optional, could be removed in production)
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

-- Add comment for documentation
COMMENT ON FUNCTION copy_category_templates_to_user IS 'Copies all category templates to a new user. Called automatically on user signup.';
COMMENT ON FUNCTION handle_new_user IS 'Trigger function that provisions categories for new users automatically.';
