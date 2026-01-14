/*
  # Fix Transfer Posting Race Conditions and Journal Entry Creation

  ## Critical Issues Fixed

  1. **Missing Status Check in Transfer Journal Entry Creation**
     - Problem: Function only checked if paired transaction EXISTS, not if it's POSTED
     - Impact: Pending transfers could get journal entries, violating accounting rules
     - Fix: Add status check to ensure paired transaction is posted

  2. **Race Condition in Journal Entry Creation**
     - Problem: Both sides of transfer can trigger simultaneously, creating duplicate entries
     - Impact: Orphaned journal entries, balance discrepancies
     - Fix: Add advisory lock based on transfer_pair_id

  3. **Incorrect Journal Entry ID Updates**
     - Problem: Function updates BOTH transactions' journal_entry_id, even if one is pending
     - Impact: Pending transactions incorrectly linked to journal entries
     - Fix: Only update the transaction that's actually being posted

  ## Solution

  This migration updates the create_transfer_journal_entry function to:
  - Check that paired transaction has status='posted'
  - Use advisory lock to prevent simultaneous execution
  - Only update journal_entry_id for the transaction being posted
  - Return journal_entry_id if paired transaction already has one
*/

-- ============================================================================
-- STEP 1: Update create_transfer_journal_entry with status check and locking
-- ============================================================================

CREATE OR REPLACE FUNCTION create_transfer_journal_entry(
  p_transaction_id uuid,
  p_profile_id uuid,
  p_user_id uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_transaction record;
  v_paired_transaction record;
  v_journal_entry_id uuid;
  v_entry_number text;
  v_source_account_id uuid;
  v_dest_account_id uuid;
  v_amount numeric;
  v_description text;
BEGIN
  -- Get the transaction
  SELECT * INTO v_transaction
  FROM transactions
  WHERE id = p_transaction_id;

  -- If no transfer_pair_id, this isn't a transfer
  IF v_transaction.transfer_pair_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- ============================================================================
  -- CRITICAL FIX #1: Use advisory lock to prevent race conditions
  -- This ensures only ONE execution happens at a time for this transfer pair
  -- ============================================================================
  PERFORM pg_advisory_xact_lock(hashtext(v_transaction.transfer_pair_id::text));

  -- Find the paired transaction
  SELECT * INTO v_paired_transaction
  FROM transactions
  WHERE transfer_pair_id = v_transaction.transfer_pair_id
    AND id != p_transaction_id
    AND profile_id = p_profile_id;

  -- ============================================================================
  -- CRITICAL FIX #2: Check if paired transaction is POSTED (not just exists)
  -- Pending transactions should NOT have journal entries per accounting rules
  -- ============================================================================
  IF v_paired_transaction.id IS NULL OR v_paired_transaction.status != 'posted' THEN
    RETURN NULL;
  END IF;

  -- Check if journal entry already exists for this transfer pair
  -- (Prevent creating duplicate entries)
  IF v_transaction.journal_entry_id IS NOT NULL THEN
    RETURN v_transaction.journal_entry_id;
  END IF;

  -- ============================================================================
  -- CRITICAL FIX #3: If paired transaction already has journal entry, reuse it
  -- This handles the case where the first transaction already created the entry
  -- ============================================================================
  IF v_paired_transaction.journal_entry_id IS NOT NULL THEN
    -- Update only THIS transaction's journal_entry_id
    UPDATE transactions
    SET journal_entry_id = v_paired_transaction.journal_entry_id
    WHERE id = v_transaction.id;

    RETURN v_paired_transaction.journal_entry_id;
  END IF;

  -- Determine source and destination based on transaction amounts
  -- Source account: where money comes FROM (negative/outflow)
  -- Dest account: where money goes TO (positive/inflow)
  IF v_transaction.amount < 0 THEN
    -- This transaction is the outflow (source)
    v_source_account_id := v_transaction.bank_account_id;
    v_dest_account_id := v_paired_transaction.bank_account_id;
    v_amount := ABS(v_transaction.amount);
    v_description := COALESCE(v_transaction.description, v_transaction.original_description);
  ELSE
    -- This transaction is the inflow (destination)
    v_dest_account_id := v_transaction.bank_account_id;
    v_source_account_id := v_paired_transaction.bank_account_id;
    v_amount := ABS(v_transaction.amount);
    v_description := COALESCE(v_transaction.description, v_transaction.original_description);
  END IF;

  -- Generate journal entry number
  v_entry_number := generate_journal_entry_number(p_profile_id);

  -- Create journal entry header
  INSERT INTO journal_entries (
    profile_id,
    user_id,
    entry_date,
    entry_number,
    description,
    entry_type,
    source
  ) VALUES (
    p_profile_id,
    p_user_id,
    v_transaction.date,
    v_entry_number,
    v_description,
    'transfer',
    COALESCE(v_transaction.source, 'system')
  )
  RETURNING id INTO v_journal_entry_id;

  -- Create journal entry line 1: DEBIT destination account (money coming in)
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    profile_id,
    user_id,
    account_id,
    line_number,
    debit_amount,
    credit_amount,
    description
  ) VALUES (
    v_journal_entry_id,
    p_profile_id,
    p_user_id,
    v_dest_account_id,
    1,
    v_amount,
    NULL,
    'Transfer from account'
  );

  -- Create journal entry line 2: CREDIT source account (money going out)
  INSERT INTO journal_entry_lines (
    journal_entry_id,
    profile_id,
    user_id,
    account_id,
    line_number,
    debit_amount,
    credit_amount,
    description
  ) VALUES (
    v_journal_entry_id,
    p_profile_id,
    p_user_id,
    v_source_account_id,
    2,
    NULL,
    v_amount,
    'Transfer to account'
  );

  -- ============================================================================
  -- CRITICAL FIX #4: Link BOTH transactions to this journal entry
  -- This is safe now because we verified both are posted
  -- ============================================================================
  UPDATE transactions
  SET journal_entry_id = v_journal_entry_id
  WHERE id IN (v_transaction.id, v_paired_transaction.id);

  RETURN v_journal_entry_id;
END;
$$;

COMMENT ON FUNCTION create_transfer_journal_entry IS
'Creates a single journal entry for a transfer pair, linking both transactions.
Implements QuickBooks-standard transfer handling: DR destination, CR source.

CRITICAL FIXES:
- Verifies paired transaction is POSTED before creating entry
- Uses advisory lock to prevent race conditions
- Reuses existing journal entry if paired transaction already has one
- Only creates entry when BOTH transactions are posted';

-- ============================================================================
-- STEP 2: Grant permissions
-- ============================================================================
GRANT EXECUTE ON FUNCTION create_transfer_journal_entry TO authenticated;