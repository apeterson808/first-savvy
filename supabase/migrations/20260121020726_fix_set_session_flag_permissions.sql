/*
  # Fix set_session_flag Permissions

  1. Problem
    - The set_session_flag RPC function exists but doesn't have GRANT EXECUTE permissions
    - Authenticated users can't call it, causing transaction posting to fail
    
  2. Solution
    - Grant EXECUTE permission to authenticated users
    - This allows transactionService.postTransaction() to work correctly
    
  3. Security
    - Function is SECURITY DEFINER so it runs with creator privileges
    - Only sets session-level config flags (not permanent)
    - Flags only affect the current session
*/

-- Grant execute permission on set_session_flag to authenticated users
GRANT EXECUTE ON FUNCTION set_session_flag(TEXT, TEXT) TO authenticated;

-- Add helpful comment
COMMENT ON FUNCTION set_session_flag IS
'Sets a session-level configuration flag. Used by transactionService to authorize status changes. Granted to authenticated users.';
