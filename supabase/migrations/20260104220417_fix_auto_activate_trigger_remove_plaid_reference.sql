/*
  # Fix auto_activate_chart_account Trigger Function

  1. Changes
    - Remove reference to non-existent plaid_account_id column
    - Keep activation logic for current_balance and institution_name
  
  2. Security
    - No RLS changes needed
*/

CREATE OR REPLACE FUNCTION auto_activate_chart_account()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.current_balance IS NOT NULL AND NEW.current_balance != 0)
     OR NEW.institution_name IS NOT NULL THEN
    NEW.is_active = true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
