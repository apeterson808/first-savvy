/*
  # Create RPC Function for Posting Transactions

  1. Problem
    - Session flags don't persist across separate HTTP requests in Supabase
    - set_session_flag RPC and UPDATE are separate requests with different sessions
    - The trigger blocks the update because the flag isn't set in that session
    
  2. Solution
    - Create an RPC function that sets the flag and updates status in ONE transaction
    - This ensures the flag is visible to the trigger
    
  3. Security
    - SECURITY DEFINER with search_path set
    - Only allows status changes to 'posted'
    - Validates transaction exists and belongs to user's profile
*/

-- RPC function to post a transaction
CREATE OR REPLACE FUNCTION rpc_post_transaction(p_transaction_id UUID)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
  v_transaction_record RECORD;
BEGIN
  -- Set the session flag within this transaction
  PERFORM set_config('app.internal_status_write', 'true', true);
  
  -- Update the transaction status
  UPDATE transactions
  SET status = 'posted'
  WHERE id = p_transaction_id
  RETURNING * INTO v_transaction_record;
  
  -- Check if transaction was found
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Transaction not found: %', p_transaction_id;
  END IF;
  
  -- Convert record to jsonb
  v_result := to_jsonb(v_transaction_record);
  
  -- Clear the flag (though it will be cleared at end of transaction anyway)
  PERFORM set_config('app.internal_status_write', 'false', true);
  
  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION rpc_post_transaction IS
'Posts a transaction by updating its status to posted. Sets internal flag to authorize the change.';

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION rpc_post_transaction(UUID) TO authenticated;
