/*
  # Drop All Remaining Matching Functions
  
  Removes all remaining automatic matching, detection, and transfer-related functions.
*/

-- Drop all auto-detection functions
DROP FUNCTION IF EXISTS auto_detect_credit_card_payments(uuid, uuid[]) CASCADE;
DROP FUNCTION IF EXISTS auto_detect_transfers(uuid, uuid[]) CASCADE;
DROP FUNCTION IF EXISTS calculate_transfer_confidence(numeric, numeric, uuid, uuid, uuid, text, text) CASCADE;
DROP FUNCTION IF EXISTS enqueue_detection(uuid, uuid[], text) CASCADE;

-- Drop matching-related functions
DROP FUNCTION IF EXISTS reject_cc_payment_match(uuid, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS reject_transfer_match(uuid, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS increment_cc_payment_pattern_acceptance(uuid) CASCADE;
DROP FUNCTION IF EXISTS increment_cc_payment_pattern_rejection(uuid) CASCADE;

-- Drop transfer-related utility functions
DROP FUNCTION IF EXISTS extract_transfer_reference(text) CASCADE;
DROP FUNCTION IF EXISTS has_transfer_keywords(text) CASCADE;

-- Drop journal entry functions for transfers and CC payments
DROP FUNCTION IF EXISTS create_transfer_journal_entry(uuid, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS create_credit_card_payment_journal_entry(uuid, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS handle_transfer_journal_entry() CASCADE;

-- Note: Keeping check_transaction_matches_rule and find_matching_rules_for_transaction 
-- as they are used for general transaction rule matching, not the auto-matching system
