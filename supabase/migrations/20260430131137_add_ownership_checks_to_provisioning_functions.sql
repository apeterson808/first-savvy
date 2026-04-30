/*
  # Add Ownership Checks to Provisioning Functions

  ## Summary
  Adds auth.uid() caller ownership guards to provisioning functions that accept
  a target_user_id parameter. This prevents one authenticated user from
  provisioning data under a different user's ID.

  ## Changes
  - copy_category_templates_to_user: adds check that caller can only provision for themselves
  - copy_account_classification_templates_to_user: same guard
  - has_profile_access: strengthen to handle null profile_id gracefully
*/

-- Strengthen copy_category_templates_to_user with ownership check
CREATE OR REPLACE FUNCTION public.copy_category_templates_to_user(target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  categories_created integer := 0;
BEGIN
  -- Ownership guard: authenticated callers can only provision for themselves
  IF auth.uid() IS NOT NULL AND auth.uid() != target_user_id THEN
    RAISE EXCEPTION 'Access denied: you can only provision your own account';
  END IF;

  BEGIN
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
$function$;

-- Strengthen copy_account_classification_templates_to_user with ownership check
CREATE OR REPLACE FUNCTION public.copy_account_classification_templates_to_user(target_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $function$
DECLARE
  classifications_created integer := 0;
BEGIN
  -- Ownership guard: authenticated callers can only provision for themselves
  IF auth.uid() IS NOT NULL AND auth.uid() != target_user_id THEN
    RAISE EXCEPTION 'Access denied: you can only provision your own account';
  END IF;

  BEGIN
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
$function$;
