/*
  # Fix trigger function to use correct column name

  1. Changes
    - Update `activate_chart_account_for_transaction` function to reference `category_account_id` instead of `chart_account_id`
    - This fixes the error: 'record "new" has no field "chart_account_id"'
  
  2. Security
    - Maintains existing SECURITY DEFINER and search_path settings
*/

CREATE OR REPLACE FUNCTION public.activate_chart_account_for_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.category_account_id IS NOT NULL THEN
    UPDATE user_chart_of_accounts
    SET is_active = true, updated_at = now()
    WHERE id = NEW.category_account_id AND is_active = false;
  END IF;
  RETURN NEW;
END;
$function$;