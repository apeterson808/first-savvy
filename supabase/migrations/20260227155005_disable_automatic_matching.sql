/*
  # Disable Automatic Matching System

  ## Changes Made

  This migration disables all automatic matching functionality while preserving manual matching capabilities.

  ### 1. Functions Dropped
    - `auto_detect_matches_unified` - Automatic detection of transfers and credit card payments
    - `auto_detect_transfers_optimized` - Legacy automatic transfer detection
    - `auto_detect_credit_card_payments_optimized` - Legacy automatic CC payment detection
    - All detection queue processing functions

  ### 2. Tables Preserved
    - `transactions` table with matching columns (`paired_transaction_id`, `match_type`, etc.) - used by manual matching
    - `transaction_match_history` - history of manual match decisions
    - All other matching-related tables remain for data integrity

  ### 3. Manual Matching Preserved
    - Users can still manually link transactions as transfers or credit card payments
    - The UI toggle between categorize/match modes remains functional
    - Manual match history and rejection tracking continues to work

  ## Notes
    - Automatic matching will no longer run on transaction import
    - Background detection worker will have nothing to process
    - All existing matched transactions remain intact
    - Manual matching via UI continues to work as before
*/

-- Drop automatic detection functions
DROP FUNCTION IF EXISTS auto_detect_matches_unified(uuid, uuid[]);
DROP FUNCTION IF EXISTS auto_detect_transfers_optimized(uuid, uuid[]);
DROP FUNCTION IF EXISTS auto_detect_credit_card_payments_optimized(uuid, uuid[]);

-- Drop detection queue processing functions (if they exist)
DROP FUNCTION IF EXISTS claim_next_job();
DROP FUNCTION IF EXISTS complete_job(uuid, jsonb);
DROP FUNCTION IF EXISTS enqueue_detection_batch(uuid, text, jsonb, text);

-- Add a comment to the transactions table documenting that automatic matching is disabled
COMMENT ON TABLE transactions IS 'Transaction records. Automatic matching is disabled. Manual matching via paired_transaction_id is still supported.';
