/*
  # Create Account Classification Auto-Provisioning System

  ## Overview
  This migration creates the auto-provisioning system that automatically copies all
  account classification templates to new users when they sign up.

  ## New Functions
  - `copy_account_classification_templates_to_user(user_id uuid)` 
    - Copies all template classifications to a new user
    - Returns the number of classifications created
    - Executes with SECURITY DEFINER to bypass RLS

  ## Updated Functions
  - Updates `handle_new_user()` to also provision account classifications

  ## Security
  - Functions execute with SECURITY DEFINER to bypass RLS during provisioning
  - Only copies from protected templates table (read-only)
  - Inserts into user's account_classifications with proper user_id ownership

  ## Process Flow
  1. User signs up → auth.users INSERT trigger fires
  2. Trigger calls handle_new_user()
  3. handle_new_user() calls copy_category_templates_to_user() (existing)
  4. handle_new_user() calls copy_account_classification_templates_to_user() (new)
  5. User receives complete set of both categories and account classifications
*/

-- ============================================================================
-- FUNCTION: Copy Account Classification Templates to User
-- ============================================================================

CREATE OR REPLACE FUNCTION copy_account_classification_templates_to_user(target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  classifications_created integer;
BEGIN
  -- Copy all account classification templates to the new user's account_classifications
  INSERT INTO account_classifications (
    user_id,
    template_id,
    class,
    type,
    category,
    display_name,
    is_custom,
    is_active
  )
  SELECT 
    target_user_id,
    id,
    class,
    type,
    category,
    NULL, -- display_name starts as NULL (will show category by default)
    false, -- not custom, copied from template
    is_active
  FROM account_classification_templates
  WHERE is_active = true
  ORDER BY display_order;

  GET DIAGNOSTICS classifications_created = ROW_COUNT;
  
  RETURN classifications_created;
END;
$$;

-- ============================================================================
-- UPDATE EXISTING HANDLE_NEW_USER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  categories_count integer;
  classifications_count integer;
BEGIN
  -- Copy category templates to the new user
  categories_count := copy_category_templates_to_user(NEW.id);
  
  -- Copy account classification templates to the new user
  classifications_count := copy_account_classification_templates_to_user(NEW.id);
  
  -- Log the provisioning (optional, could be removed in production)
  RAISE NOTICE 'Provisioned % categories and % account classifications for new user %', 
    categories_count, classifications_count, NEW.id;
  
  RETURN NEW;
END;
$$;

-- ============================================================================
-- DOCUMENTATION
-- ============================================================================

COMMENT ON FUNCTION copy_account_classification_templates_to_user IS 
  'Copies all account classification templates to a new user. Called automatically on user signup.';

COMMENT ON FUNCTION handle_new_user IS 
  'Trigger function that provisions categories and account classifications for new users automatically.';
