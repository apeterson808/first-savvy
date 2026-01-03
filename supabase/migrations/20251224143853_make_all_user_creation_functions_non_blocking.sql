/*
  # Make All User Creation Functions Non-Blocking
  
  ## Problem
  Multiple triggers fire during user signup, and if ANY of them fail, the entire
  user creation is rolled back. We have three triggers:
  1. create_user_profile - inserts into user_profiles
  2. handle_new_user - tries to copy categories/classifications (tables don't exist)
  3. handle_new_user_profile - creates profile, membership, chart of accounts
  
  The handle_new_user trigger is failing because categories and account_classifications
  tables no longer exist in the schema.
  
  ## Solution
  Update all trigger functions to be non-blocking by wrapping their operations
  in exception handlers. This allows user creation to succeed even if some
  provisioning steps fail.
  
  ## Changes
  - Update create_user_profile to handle errors gracefully
  - Update handle_new_user to skip missing tables gracefully
  - Update copy functions to handle missing tables
*/

-- Update create_user_profile to be non-blocking
CREATE OR REPLACE FUNCTION public.create_user_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  BEGIN
    INSERT INTO user_profiles (id, email, created_at, updated_at)
    VALUES (
      NEW.id,
      NEW.email,
      now(),
      now()
    )
    ON CONFLICT (id) DO NOTHING;
    
    RAISE NOTICE 'Created user_profile for user %', NEW.id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to create user_profile for user %: %', NEW.id, SQLERRM;
  END;
  
  RETURN NEW;
END;
$$;

-- Update handle_new_user to be non-blocking
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  categories_count integer := 0;
  classifications_count integer := 0;
BEGIN
  BEGIN
    -- Try to copy category templates if the table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'categories') THEN
      categories_count := copy_category_templates_to_user(NEW.id);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to copy categories for user %: %', NEW.id, SQLERRM;
  END;

  BEGIN
    -- Try to copy classification templates if the table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'account_classifications') THEN
      classifications_count := copy_account_classification_templates_to_user(NEW.id);
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Failed to copy classifications for user %: %', NEW.id, SQLERRM;
  END;

  RAISE NOTICE 'Provisioned % categories and % classifications for user %', 
    categories_count, classifications_count, NEW.id;

  RETURN NEW;
END;
$$;

-- Update copy_category_templates_to_user to handle missing table
CREATE OR REPLACE FUNCTION public.copy_category_templates_to_user(target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  categories_created integer := 0;
BEGIN
  BEGIN
    -- Check if tables exist before trying to copy
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'categories') 
       AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'category_templates') THEN
      
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
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Error copying category templates: %', SQLERRM;
      categories_created := 0;
  END;

  RETURN categories_created;
END;
$$;

-- Update copy_account_classification_templates_to_user to handle missing table
CREATE OR REPLACE FUNCTION public.copy_account_classification_templates_to_user(target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  classifications_created integer := 0;
BEGIN
  BEGIN
    -- Check if tables exist before trying to copy
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'account_classifications') 
       AND EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'account_classification_templates') THEN
      
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
        NULL,
        false,
        is_active
      FROM account_classification_templates
      WHERE is_active = true
      ORDER BY display_order;

      GET DIAGNOSTICS classifications_created = ROW_COUNT;
    END IF;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE WARNING 'Error copying account classification templates: %', SQLERRM;
      classifications_created := 0;
  END;

  RETURN classifications_created;
END;
$$;
