/*
  # Fix Function Search Path Security

  1. Changes
    - Add SECURITY DEFINER to update_updated_at_column function
    - Set explicit search_path to public schema
  
  2. Security Impact
    - Prevents search_path manipulation attacks
    - Ensures function executes in a predictable schema context
*/

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;