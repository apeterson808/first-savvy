/*
  # Fix Balance Update Trigger Function Calls with Schema Qualification

  ## Problem
  The previous migration fixed table references but missed function calls.
  When `update_account_balance_from_journal()` executes with `SET search_path TO ''`,
  it cannot find `recalculate_account_balance()` because the function call lacks 
  schema qualification.

  ## Solution
  Update the trigger function to call `public.recalculate_account_balance()` 
  instead of `recalculate_account_balance()`.

  ## Impact
  - Fixes "function recalculate_account_balance(uuid) does not exist" error
  - Allows journal entry deletions to complete successfully
  - Enables the reset-financial-data edge function to work properly
*/

-- Recreate the trigger function with properly schema-qualified function calls
CREATE OR REPLACE FUNCTION update_account_balance_from_journal()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
BEGIN
  -- Handle DELETE
  IF TG_OP = 'DELETE' THEN
    UPDATE public.user_chart_of_accounts
    SET current_balance = public.recalculate_account_balance(OLD.account_id)
    WHERE id = OLD.account_id;

    RETURN OLD;

  -- Handle UPDATE
  ELSIF TG_OP = 'UPDATE' THEN
    -- Update old account if it changed
    IF OLD.account_id != NEW.account_id THEN
      UPDATE public.user_chart_of_accounts
      SET current_balance = public.recalculate_account_balance(OLD.account_id)
      WHERE id = OLD.account_id;
    END IF;

    -- Update new account
    UPDATE public.user_chart_of_accounts
    SET current_balance = public.recalculate_account_balance(NEW.account_id)
    WHERE id = NEW.account_id;

    RETURN NEW;

  -- Handle INSERT
  ELSIF TG_OP = 'INSERT' THEN
    UPDATE public.user_chart_of_accounts
    SET current_balance = public.recalculate_account_balance(NEW.account_id)
    WHERE id = NEW.account_id;

    RETURN NEW;
  END IF;

  RETURN NULL;
END;
$$;

COMMENT ON FUNCTION update_account_balance_from_journal IS
'Updates account balances when journal entry lines change. All references are schema-qualified for security.';