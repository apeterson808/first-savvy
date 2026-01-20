/*
  # Create Session Flag Helper and Status Gate Trigger (SAFETY NIT 3)

  ## Summary
  Implements strict service boundary enforcement for transaction status changes.
  Only transactionService can change transaction status (via session flag or service_role).
  
  ## Components Created
  
  ### 1. set_session_flag RPC
  - Allows authorized services to set session flags
  - Used by transactionService before status updates
  
  ### 2. check_status_change_via_rpc Trigger Function
  - Blocks direct status updates unless flag is set or service_role
  - Raises clear error message directing users to use transactionService
  
  ### 3. a_prevent_direct_status_updates Trigger
  - Uses 'a_' prefix to run BEFORE other triggers (alphabetic ordering)
  - Ensures gate runs before posting trigger
  
  ## Security
  - SECURITY DEFINER with search_path set
  - Service role bypass for system operations
  - Clear error messages for developers
*/

-- Session flag helper RPC
CREATE OR REPLACE FUNCTION set_session_flag(flag_name TEXT, flag_value TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM set_config('app.' || flag_name, flag_value, true);
END;
$$;

COMMENT ON FUNCTION set_session_flag IS
'Sets a session-level configuration flag. Used by transactionService to authorize status changes.';

-- Status change gate trigger function
CREATE OR REPLACE FUNCTION check_status_change_via_rpc()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_session_flag TEXT;
  v_current_role TEXT;
BEGIN
  -- If status hasn't changed, allow through
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;

  -- Check session flag
  v_session_flag := current_setting('app.internal_status_write', true);
  v_current_role := current_role;

  -- Allow if flag is set or if service_role (for migrations/admin)
  IF v_session_flag = 'true' OR v_current_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Block and provide helpful error message
  RAISE EXCEPTION 'Direct status updates not allowed. Use transactionService.postTransaction() or transactionService.undoPostTransaction()';
END;
$$;

COMMENT ON FUNCTION check_status_change_via_rpc IS
'Enforces service boundary: only transactionService can change transaction.status';

-- Drop existing trigger if it exists (to recreate with correct name)
DROP TRIGGER IF EXISTS prevent_direct_status_updates ON transactions;
DROP TRIGGER IF EXISTS a_prevent_direct_status_updates ON transactions;

-- Create trigger with 'a_' prefix to ensure it runs first (alphabetic ordering)
CREATE TRIGGER a_prevent_direct_status_updates
  BEFORE UPDATE OF status ON transactions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION check_status_change_via_rpc();

COMMENT ON TRIGGER a_prevent_direct_status_updates ON transactions IS
'Runs first (a_ prefix) to enforce service boundary before other triggers execute';
